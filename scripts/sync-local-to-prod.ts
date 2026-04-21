// One-shot migration: sync the local docker Toilet table into prod
// Supabase. Recovers from the env-trap where --env-file=.env.local was
// silently overriding externally exported DATABASE_URL, causing every
// M8 DeepL translation and M12 global OSM import (all ~355k new rows)
// to land in local docker instead of prod. Prod was frozen at M10 P1's
// 10,107 rows while local ballooned to 365,759.
//
// Strategy:
//   1. Two explicit Prisma clients — LOCAL_DATABASE_URL (source) vs
//      DATABASE_URL (target). No shared globals, no --env-file coupling.
//   2. Filter to rows with osmId IS NOT NULL. user/seed rows stay
//      wherever they currently live; OSM rows upsert cleanly on osmId.
//   3. Preflight slug-collision check against prod's existing slugs
//      (prod's M11 Tokyo 10k has M11-format slugs, local has M12-format
//      — matching osmIds will route to update which won't touch slug,
//      so the only collision risk is if a new-row slug happens to hit
//      a prod row with a different osmId or no osmId).
//   4. Batch 500 / Promise.all upsert with progress reporting.
//   5. upsert update path leaves slug / status / source / publishedAt /
//      admin-state fields alone (cleanliness, reviewCount, photoCount,
//      lastConfirmedAt, lastCommunityEdit*). Only OSM payload flows:
//      name / address / type / latitude / longitude.
//
// Usage:
//   export DATABASE_URL='<prod Supabase URI>'
//   pnpm sync:local-to-prod           # actual sync
//   pnpm sync:local-to-prod --dry-run # preflight only, no writes
//
// Optional:
//   LOCAL_DATABASE_URL='<override>' pnpm sync:local-to-prod
//   (defaults to postgresql://toirepo:toirepo@localhost:5433/toirepo)

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, type Prisma } from '@/generated/prisma'

// Fields flowing through the upsert. Declared once so the
// local.toilet.findMany batch in Phase 3 has a stable shape.
type SyncRow = {
  id: string
  slug: string
  osmId: string | null
  type: Prisma.ToiletGetPayload<object>['type']
  name: Prisma.JsonValue
  address: Prisma.JsonValue
  latitude: number
  longitude: number
  status: Prisma.ToiletGetPayload<object>['status']
  source: Prisma.ToiletGetPayload<object>['source']
  publishedAt: Date | null
}

const DEFAULT_LOCAL_URL = 'postgresql://toirepo:toirepo@localhost:5433/toirepo?schema=public'
const BATCH_SIZE = 500
const LOGS_DIR = 'logs'

function makeClient(connectionString: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter, log: ['error'] })
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return '(unparseable URL)'
  }
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')

  const LOCAL_URL = process.env.LOCAL_DATABASE_URL ?? DEFAULT_LOCAL_URL
  const PROD_URL = process.env.DATABASE_URL
  if (!PROD_URL) {
    console.error('✗ DATABASE_URL is required — set to the prod Supabase URI before running')
    process.exit(1)
  }

  const localHost = hostOf(LOCAL_URL)
  const prodHost = hostOf(PROD_URL)

  if (prodHost.includes('localhost') || prodHost.includes('127.0.0.1')) {
    console.error(
      `✗ DATABASE_URL resolves to ${prodHost} — expected prod host. Refusing to sync local-to-local.`,
    )
    process.exit(1)
  }

  console.log(`🧭 Sync local → prod${dryRun ? ' (DRY RUN)' : ''}`)
  console.log(`   Source (LOCAL_DATABASE_URL):  ${localHost}`)
  console.log(`   Target (DATABASE_URL):        ${prodHost}`)

  if (!dryRun) {
    console.log(`\n⏰ 5s grace period to cancel with Ctrl+C…`)
    await new Promise((r) => setTimeout(r, 5000))
  }

  const local = makeClient(LOCAL_URL)
  const prod = makeClient(PROD_URL)

  try {
    // ── Phase 1: counts ──
    console.log(`\n📊 Row counts`)
    const localTotal = await local.toilet.count()
    const localOsm = await local.toilet.count({ where: { osmId: { not: null } } })
    const prodTotalBefore = await prod.toilet.count()
    const prodOsmBefore = await prod.toilet.count({ where: { osmId: { not: null } } })
    console.log(`   Local total:       ${localTotal}`)
    console.log(`   Local with osmId:  ${localOsm}  ← candidates to sync`)
    console.log(`   Prod total:        ${prodTotalBefore}`)
    console.log(`   Prod with osmId:   ${prodOsmBefore}`)

    // ── Phase 2: preflight slug collision check ──
    console.log(`\n🔍 Loading prod slug ↔ osmId map for collision pre-check…`)
    const prodRows = await prod.toilet.findMany({
      select: { slug: true, osmId: true },
    })
    const prodSlugToOsmId = new Map<string, string | null>()
    for (const p of prodRows) prodSlugToOsmId.set(p.slug, p.osmId)
    console.log(`   ${prodSlugToOsmId.size} existing prod slugs indexed`)

    console.log(`\n🔍 Scanning local OSM rows for slug collisions against prod…`)
    const collisions: Array<{
      localSlug: string
      localOsmId: string
      prodOsmId: string | null
    }> = []

    // Stream local osmId-bearing rows in id-ordered batches.
    let cursor: string | null = null
    let scanned = 0
    for (;;) {
      const batch: Array<{ id: string; slug: string; osmId: string | null }> =
        await local.toilet.findMany({
          where: { osmId: { not: null }, ...(cursor ? { id: { gt: cursor } } : {}) },
          select: { id: true, slug: true, osmId: true },
          orderBy: { id: 'asc' },
          take: BATCH_SIZE,
        })
      if (batch.length === 0) break

      for (const row of batch) {
        const existingOwner = prodSlugToOsmId.get(row.slug)
        if (existingOwner !== undefined && existingOwner !== row.osmId) {
          collisions.push({
            localSlug: row.slug,
            localOsmId: row.osmId!,
            prodOsmId: existingOwner,
          })
        }
      }
      scanned += batch.length
      cursor = batch[batch.length - 1].id
    }
    console.log(`   Scanned ${scanned} candidates; ${collisions.length} slug collisions`)

    if (collisions.length > 0) {
      mkdirSync(LOGS_DIR, { recursive: true })
      const collisionFile = join(LOGS_DIR, `sync-slug-collisions-${Date.now()}.json`)
      writeFileSync(collisionFile, JSON.stringify(collisions, null, 2))
      console.error(`\n✗ ${collisions.length} slug collision(s) — aborting before sync.`)
      console.error(`   First 5:`)
      for (const c of collisions.slice(0, 5)) {
        console.error(
          `   slug='${c.localSlug}'  local=${c.localOsmId}  vs prod=${c.prodOsmId ?? '(user/seed)'}`,
        )
      }
      console.error(`   Full list: ${collisionFile}`)
      console.error(
        `\n   Resolution options:\n` +
          `     (a) rename the conflicting prod rows (UPDATE "Toilet" SET slug = ... WHERE slug = '<one of the above>')\n` +
          `     (b) exclude the conflicting local osmIds from the sync by adjusting this script's where-clause.`,
      )
      await local.$disconnect()
      await prod.$disconnect()
      process.exit(2)
    }

    if (dryRun) {
      console.log(`\n✅ DRY RUN complete. No writes. Plan: upsert ${localOsm} rows.`)
      await local.$disconnect()
      await prod.$disconnect()
      return
    }

    // ── Phase 3: batched upsert ──
    console.log(
      `\n⚙️  Upserting ${localOsm} local-osmId rows into prod in batches of ${BATCH_SIZE}…`,
    )
    const startTime = Date.now()
    let done = 0
    let created = 0
    let updated = 0
    let lastReport = 0
    let lastError: unknown = null
    const failed: Array<{ osmId: string; slug: string; error: string }> = []

    cursor = null
    for (;;) {
      const batch: SyncRow[] = await local.toilet.findMany({
        where: { osmId: { not: null }, ...(cursor ? { id: { gt: cursor } } : {}) },
        select: {
          id: true,
          slug: true,
          osmId: true,
          type: true,
          name: true,
          address: true,
          latitude: true,
          longitude: true,
          status: true,
          source: true,
          publishedAt: true,
        },
        orderBy: { id: 'asc' },
        take: BATCH_SIZE,
      })
      if (batch.length === 0) break

      const results = await Promise.allSettled(
        batch.map(async (t) => {
          // Check existence first so we can count create vs update. A bit
          // redundant with upsert's internal branch but the counter is
          // nice for the progress report.
          const existing = await prod.toilet.findUnique({
            where: { osmId: t.osmId! },
            select: { id: true },
          })

          await prod.toilet.upsert({
            where: { osmId: t.osmId! },
            create: {
              slug: t.slug,
              osmId: t.osmId,
              type: t.type,
              name: t.name as object,
              address: t.address as object,
              latitude: t.latitude,
              longitude: t.longitude,
              status: t.status,
              source: t.source,
              publishedAt: t.publishedAt,
            },
            update: {
              // Only the OSM payload flows — do NOT touch slug, status,
              // source, publishedAt, or any admin-state field. Prod's
              // existing Tokyo slugs stay (stable URLs), and any admin
              // review / community edit on an existing row survives.
              type: t.type,
              name: t.name as object,
              address: t.address as object,
              latitude: t.latitude,
              longitude: t.longitude,
            },
          })

          return existing ? 'updated' : 'created'
        }),
      )

      for (let i = 0; i < results.length; i++) {
        const r = results[i]
        if (r.status === 'fulfilled') {
          if (r.value === 'created') created++
          else updated++
        } else {
          lastError = r.reason
          const t = batch[i]
          failed.push({
            osmId: t.osmId ?? '(null)',
            slug: t.slug,
            error: r.reason instanceof Error ? r.reason.message : String(r.reason),
          })
        }
      }

      done += batch.length
      cursor = batch[batch.length - 1].id

      if (done - lastReport >= 2000 || done === localOsm) {
        const pct = ((done / localOsm) * 100).toFixed(1)
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
        console.log(
          `   ${done}/${localOsm} (${pct}%) · ${elapsed}s · +${created} created / ${updated} updated / ${failed.length} failed`,
        )
        lastReport = done
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`\n✅ Sync complete in ${totalTime}s`)
    console.log(`   Rows created: ${created}`)
    console.log(`   Rows updated: ${updated}`)
    console.log(`   Rows failed:  ${failed.length}`)

    if (failed.length > 0) {
      mkdirSync(LOGS_DIR, { recursive: true })
      const failFile = join(LOGS_DIR, `sync-failed-${Date.now()}.json`)
      writeFileSync(failFile, JSON.stringify(failed, null, 2))
      console.error(`\n⚠️  ${failed.length} rows failed — see ${failFile}`)
      console.error(`   Last error: ${lastError instanceof Error ? lastError.message : lastError}`)
    }

    // ── Phase 4: post-sync verification ──
    console.log(`\n🔍 Post-sync verification`)
    const prodTotalAfter = await prod.toilet.count()
    const prodOsmAfter = await prod.toilet.count({ where: { osmId: { not: null } } })
    console.log(
      `   Prod total:        ${prodTotalAfter}  (was ${prodTotalBefore}, +${prodTotalAfter - prodTotalBefore})`,
    )
    console.log(
      `   Prod with osmId:   ${prodOsmAfter}  (was ${prodOsmBefore}, +${prodOsmAfter - prodOsmBefore})`,
    )

    if (prodOsmAfter < localOsm) {
      console.error(
        `\n⚠️  Prod osmId count (${prodOsmAfter}) is less than local osmId count (${localOsm}). Expected equal.`,
      )
    } else {
      console.log(
        `\n✅ Prod now carries ≥ ${localOsm} OSM rows. Hard-reload toirepo.com to verify.`,
      )
    }
  } finally {
    await local.$disconnect()
    await prod.$disconnect()
  }
}

main().catch((e) => {
  console.error('✗ Sync failed:', e)
  process.exit(1)
})
