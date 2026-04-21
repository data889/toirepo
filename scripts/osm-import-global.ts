// Global OSM toilet import, continent-by-continent.
//
// Companion to scripts/osm-import.ts (Tokyo-focused). This one
// targets amenity=toilets ONLY (no shop/mall expansion — global
// shops have inconsistent toilet-access semantics, Tokyo's
// convenience-store assumption doesn't generalize). Expected
// 300k-400k rows worldwide per OSM 2024 density.
//
// Strategy: split the world into 15 regional bboxes (4 continent-
// sized + 11 sub-bboxes for the 3 continents that hit Overpass 504
// on the first production run: Oceania / Europe / Asia). Run each
// Overpass query sequentially with a 30s cooldown, cache each
// region's raw response to logs/ for resume-after-interrupt, then
// upsert via the same osmId-keyed flow as the Tokyo script.
//
// Usage:
//   DATABASE_URL='...' pnpm osm:import-global
//   DATABASE_URL='...' pnpm osm:import-global --regions=oceania_nz
//   DATABASE_URL='...' pnpm osm:import-global --regions=asia_japan,asia_se
//   DATABASE_URL='...' pnpm osm:import-global --dry-run
//
// Production-run playbook: docs/osm-import-global.md

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { db } from '../src/server/db'
import { queryOverpass, type OverpassResponse } from '../src/server/osm/client'
import { mapOsmElement, type BboxGuard, type OsmToiletCandidate } from '../src/server/osm/mapping'

type Region = {
  name: string
  // [south, west, north, east] per Overpass bbox order.
  bbox: [number, number, number, number]
}

// 15 regional bboxes. First 4 are the continent-sized queries that
// already completed on the initial prod run (cached in logs/). The
// other 11 are sub-bboxes replacing the 3 continents (Oceania /
// Europe / Asia) that hit Overpass 504 on the big bbox — each
// sub-bbox stays well below the server's implicit size/time limits.
//
// Overlaps are intentional where natural continent seams don't line
// up (e.g. europe_russia_w vs russia_east over [42-68, 25-60]).
// osmId is @unique in Toilet, so upsert absorbs duplicates cleanly.
// Known overlaps:
//   europe_russia_w ∩ russia_east    (Russia's European vs Asian parts)
//   asia_japan      ∩ Tokyo 10k rows (M11 import — dedupe via osmId)
//   oceania_pi      ∩ oceania_nz     (~ [-25..-33, 165..180] strip)
const REGIONS: Region[] = [
  // ── Already-imported continents (M12 prod batch 1) ──
  { name: 'south_america', bbox: [-56, -85, 15, -34] },
  { name: 'africa', bbox: [-35, -20, 38, 55] },
  { name: 'north_america', bbox: [15, -170, 72, -50] },
  { name: 'russia_east', bbox: [40, 25, 72, 180] },

  // ── Oceania sub-bboxes (was: oceania [-48, 110, 0, 180] → 504) ──
  { name: 'oceania_au', bbox: [-44, 110, -10, 155] }, // Australia mainland
  { name: 'oceania_nz', bbox: [-48, 165, -33, 180] }, // New Zealand
  { name: 'oceania_pi', bbox: [-25, 155, 0, 180] }, // Pacific islands

  // ── Europe sub-bboxes (was: europe [35, -30, 72, 50] → 504) ──
  { name: 'europe_west', bbox: [35, -10, 58, 15] }, // UK / FR / DE-south / Iberia
  { name: 'europe_nordic', bbox: [55, 4, 72, 32] }, // Nordics + RU-NW
  { name: 'europe_east', bbox: [35, 15, 58, 50] }, // Eastern Europe + Balkans
  { name: 'europe_russia_w', bbox: [42, 25, 68, 60] }, // Russia's European side

  // ── Asia sub-bboxes (was: asia [-12, 25, 55, 180] → 504) ──
  { name: 'asia_japan', bbox: [24, 122, 46, 146] }, // Japan + Korea
  { name: 'asia_china', bbox: [18, 73, 54, 135] }, // China (largest; may 504 again → split further)
  { name: 'asia_india', bbox: [6, 68, 37, 98] }, // India + Pakistan + Bangladesh
  { name: 'asia_se', bbox: [-11, 92, 24, 141] }, // SE Asia
  { name: 'asia_middle', bbox: [12, 25, 45, 73] }, // Middle East
]

const BATCH_SIZE = 500
const CONFLICT_RADIUS_M = 10
const SLEEP_BETWEEN_REGIONS_MS = 30_000
const LOGS_DIR = 'logs'

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function toiletsOqlForBbox([s, w, n, e]: [number, number, number, number]): string {
  // out center; even though amenity=toilets is mostly nodes — some
  // OSM editors tag entire buildings as toilets via way, and the
  // centroid keeps them geocodable.
  // Timeout 120s: sub-bboxes should return well under this; the
  // original continent-sized queries used 300s but still hit 504
  // on the public Overpass server's own limits.
  return `[out:json][timeout:120];
(
  node["amenity"="toilets"](${s},${w},${n},${e});
  way["amenity"="toilets"](${s},${w},${n},${e});
);
out center;`
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

// Deterministic slug from an OSM toilet candidate. The full osmIdShort
// (e.g. "node-123456789", ~17 chars max) is ALWAYS preserved — that's
// the only part guaranteed unique. Base is truncated to fit the 80-char
// Toilet.slug budget. Bug history: previously we did
// `${base}-${id}`.slice(0, 80) which could clip the id suffix when base
// was long, collapsing distinct osmIds onto the same slug and throwing
// P2002 mid-batch (surfaced during prod Asia import, 6000 rows in).
const MAX_SLUG_LEN = 80
function computeSlug(c: OsmToiletCandidate): string {
  const nameSource = c.name.en || c.name.ja || c.name['zh-CN'] || 'toilet'
  const baseSlug = slugify(nameSource) || 'toilet'
  const osmIdShort = c.osmId.replace(/\//g, '-')
  const budgetForBase = MAX_SLUG_LEN - osmIdShort.length - 1 // -1 for the connecting '-'
  if (budgetForBase <= 0) {
    // Pathological: osmId alone ≥ 80 chars. OSM IDs cap at ~18 chars
    // including the "node-"/"way-" prefix, so this branch is defensive
    // against future format changes rather than a real-world path.
    return osmIdShort.slice(0, MAX_SLUG_LEN)
  }
  const truncatedBase = baseSlug.slice(0, budgetForBase).replace(/-+$/, '')
  return truncatedBase.length > 0 ? `${truncatedBase}-${osmIdShort}` : osmIdShort
}

async function fetchRegion(region: Region, useCache: boolean): Promise<OverpassResponse> {
  const cachePath = join(LOGS_DIR, `osm-global-${region.name}.json`)
  if (useCache && existsSync(cachePath)) {
    console.log(`   [cache] ${region.name} → ${cachePath}`)
    return JSON.parse(readFileSync(cachePath, 'utf-8')) as OverpassResponse
  }
  console.log(
    `   [net] ${region.name} bbox=[${region.bbox.join(',')}] — this may take 2-5 min on large continents`,
  )
  const response = await queryOverpass(toiletsOqlForBbox(region.bbox))
  mkdirSync(LOGS_DIR, { recursive: true })
  writeFileSync(cachePath, JSON.stringify(response))
  console.log(`   [cached] ${region.name}: ${response.elements.length} elements → ${cachePath}`)
  return response
}

interface ExistingRow {
  id: string
  slug: string
  latitude: number
  longitude: number
  osmId: string | null
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const noCache = args.includes('--no-cache')
  const regionsArg = args.find((a) => a.startsWith('--regions='))?.split('=')[1]
  const targetRegions: Region[] = regionsArg
    ? REGIONS.filter((r) => regionsArg.split(',').includes(r.name))
    : REGIONS

  if (targetRegions.length === 0) {
    console.error('✗ No regions matched. Available:', REGIONS.map((r) => r.name).join(', '))
    process.exit(1)
  }

  console.log(
    `🌍 Global OSM toilet import${dryRun ? ' (DRY RUN)' : ''} — regions: ${targetRegions.map((r) => r.name).join(', ')}`,
  )

  // ── Phase 1: fetch all regions ──
  const responses: Array<{ region: Region; response: OverpassResponse }> = []
  for (let i = 0; i < targetRegions.length; i++) {
    const region = targetRegions[i]
    console.log(`\n📡 [${i + 1}/${targetRegions.length}] Fetching ${region.name}`)
    try {
      const response = await fetchRegion(region, !noCache)
      responses.push({ region, response })
    } catch (e) {
      console.error(`✗ ${region.name} failed:`, e instanceof Error ? e.message : e)
      console.error(`   Continuing with other regions. Rerun --regions=${region.name} to retry.`)
      continue
    }
    if (i < targetRegions.length - 1) {
      console.log(`   Sleeping ${SLEEP_BETWEEN_REGIONS_MS / 1000}s before next region…`)
      await sleep(SLEEP_BETWEEN_REGIONS_MS)
    }
  }

  // ── Phase 2: flatten + map ──
  // Pass each region's bbox as the guard so mapOsmElement doesn't
  // fall back to its Tokyo-only default (which would mass-reject).
  const allCandidates: OsmToiletCandidate[] = []
  for (const { region, response } of responses) {
    const guard: BboxGuard = region.bbox
    let regionCount = 0
    for (const el of response.elements) {
      const c = mapOsmElement(el, guard)
      if (c) {
        allCandidates.push(c)
        regionCount++
      }
    }
    console.log(
      `   ${region.name}: ${regionCount} valid toilets (of ${response.elements.length} raw elements)`,
    )
  }
  console.log(`\n📦 Total candidates across regions: ${allCandidates.length}`)

  // ── Phase 3: conflict grid + dedupe ──
  console.log(`\n🔍 Loading existing Toilets for conflict detection…`)
  const existing: ExistingRow[] = await db.toilet.findMany({
    select: {
      id: true,
      slug: true,
      latitude: true,
      longitude: true,
      osmId: true,
    },
  })
  console.log(`   Existing rows: ${existing.length}`)

  // 0.001° ≈ 100m at tropical latitudes, ~70m at Tokyo; 3×3 bin window
  // covers the 10m conflict radius with plenty of headroom.
  const grid = new Map<string, ExistingRow[]>()
  const binOf = (lat: number, lon: number) => `${Math.floor(lat * 1000)},${Math.floor(lon * 1000)}`
  for (const e of existing) {
    const key = binOf(e.latitude, e.longitude)
    const arr = grid.get(key) ?? []
    arr.push(e)
    grid.set(key, arr)
  }

  function conflictsWithNonOsm(c: OsmToiletCandidate): boolean {
    const latBin = Math.floor(c.latitude * 1000)
    const lonBin = Math.floor(c.longitude * 1000)
    for (let dLat = -1; dLat <= 1; dLat++) {
      for (let dLon = -1; dLon <= 1; dLon++) {
        const arr = grid.get(`${latBin + dLat},${lonBin + dLon}`)
        if (!arr) continue
        for (const e of arr) {
          if (e.osmId === c.osmId) continue
          if (e.osmId) continue // other-osmId row: skip (data-quality dup)
          if (
            haversineMeters(c.latitude, c.longitude, e.latitude, e.longitude) < CONFLICT_RADIUS_M
          ) {
            return true
          }
        }
      }
    }
    return false
  }

  const existingByOsmId = new Set(existing.filter((e) => e.osmId).map((e) => e.osmId!))

  let conflictCount = 0
  let alreadyImportedCount = 0
  const toUpsert: OsmToiletCandidate[] = []
  for (const c of allCandidates) {
    if (existingByOsmId.has(c.osmId)) {
      alreadyImportedCount++
      toUpsert.push(c)
      continue
    }
    if (conflictsWithNonOsm(c)) {
      conflictCount++
      continue
    }
    toUpsert.push(c)
  }

  console.log(`\n📊 Import plan:`)
  console.log(`   Total candidates:          ${allCandidates.length}`)
  console.log(`   Already imported (upsert): ${alreadyImportedCount}`)
  console.log(`   10m conflicts (skip):      ${conflictCount}`)
  console.log(`   Net new inserts:           ${toUpsert.length - alreadyImportedCount}`)
  console.log(`   Total upsert operations:   ${toUpsert.length}`)

  // ── Phase 3.5: slug collision pre-check ──
  // Surface duplicate slugs BEFORE hitting the DB. Catches both:
  //   1. Two candidates in this batch produce the same slug (the P2002
  //      bug at prod Asia batch 6000+).
  //   2. A candidate's new slug would collide with an existing row's
  //      slug (possible when healing old-format slugs via update on
  //      rows that happen to share a base name with a different osmId).
  // The "claims" map starts seeded with every existing slug tagged by
  // its owning osmId (or a sentinel for user/seed rows); we then walk
  // candidates and flag any slug whose claim is held by a different id.
  const EXISTING_NO_OSMID = '__existing-no-osmid__'
  const claims = new Map<string, string>() // slug → osmId claiming it
  for (const e of existing) {
    if (!claims.has(e.slug)) {
      claims.set(e.slug, e.osmId ?? EXISTING_NO_OSMID)
    }
  }
  const collisions: Array<[string, string, string]> = [] // [slug, candidate, owner]
  let uniqueCandidateSlugs = 0
  for (const c of toUpsert) {
    const slug = computeSlug(c)
    const prior = claims.get(slug)
    if (prior !== undefined && prior !== c.osmId) {
      collisions.push([slug, c.osmId, prior])
    } else if (prior === undefined) {
      claims.set(slug, c.osmId)
      uniqueCandidateSlugs++
    }
  }
  console.log(`   Unique candidate slugs:    ${uniqueCandidateSlugs} net-new slugs`)
  console.log(`   Slug collisions:           ${collisions.length}`)
  if (collisions.length > 0) {
    console.error(`\n✗ ${collisions.length} slug collision(s) detected — aborting before DB write.`)
    for (const [slug, candidate, owner] of collisions.slice(0, 10)) {
      console.error(`   slug='${slug}'  candidate=${candidate}  conflicts-with=${owner}`)
    }
    if (collisions.length > 10) {
      console.error(`   … and ${collisions.length - 10} more.`)
    }
    await db.$disconnect()
    process.exit(1)
  }

  if (dryRun) {
    console.log(`\n✅ DRY RUN complete. No DB changes.`)
    await db.$disconnect()
    return
  }

  // ── Phase 4: upsert ──
  console.log(`\n⚙️  Upserting in batches of ${BATCH_SIZE}…`)
  const startTime = Date.now()
  let done = 0
  let lastReport = 0

  for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
    const batch = toUpsert.slice(i, i + BATCH_SIZE)
    await Promise.all(
      batch.map(async (c) => {
        const slug = computeSlug(c)

        await db.toilet.upsert({
          where: { osmId: c.osmId },
          create: {
            slug,
            osmId: c.osmId,
            name: c.name,
            address: c.address,
            type: c.type,
            latitude: c.latitude,
            longitude: c.longitude,
            status: 'APPROVED',
            source: 'OSM_IMPORT',
            publishedAt: new Date(),
          },
          update: {
            // slug in update so re-runs heal rows created with the
            // pre-fix collision-prone truncation. Safe because
            // computeSlug is deterministic per osmId and the Phase 3.5
            // check proves no two toUpsert entries share a slug.
            slug,
            name: c.name,
            address: c.address,
            type: c.type,
            latitude: c.latitude,
            longitude: c.longitude,
          },
        })
      }),
    )
    done += batch.length
    if (done - lastReport >= 2000 || done === toUpsert.length) {
      const pct = ((done / toUpsert.length) * 100).toFixed(1)
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(`   ${done}/${toUpsert.length} (${pct}%) · ${elapsed}s`)
      lastReport = done
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\n✅ Import complete in ${totalTime}s`)

  const finalCount = await db.toilet.count({ where: { status: 'APPROVED' } })
  const osmCount = await db.toilet.count({ where: { osmId: { not: null } } })
  console.log(`\n📈 DB state after import:`)
  console.log(`   Total APPROVED toilets:        ${finalCount}`)
  console.log(`   From OSM (has osmId):          ${osmCount}`)
  console.log(`   From user/seed (no osmId):     ${finalCount - osmCount}`)
}

main()
  .catch((e) => {
    console.error('✗ Global import failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
