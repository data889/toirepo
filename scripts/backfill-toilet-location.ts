// M12 repair: backfill Toilet.location for rows where the PostGIS
// geography column is NULL.
//
// Symptom: after the M12 prod OSM imports (Tokyo 10k → 242k → 365k),
// toilet.listByBbox returns 0 rows for every non-Tokyo city. Tokyo
// queries still work, so the SQL + envelope path is fine; the rows
// themselves are missing their `location` geography.
//
// Trigger provenance (prisma/migrations/20260419001746_add_spatial_
// index_and_trigger/migration.sql): a BEFORE INSERT OR UPDATE OF
// latitude, longitude trigger fires update_toilet_location() on
// every INSERT, synthesizing `location` from `longitude`+`latitude`.
// Both scripts/osm-import.ts (M11 Tokyo) and scripts/osm-import-
// global.ts (M12) rely on the trigger — neither writes location
// directly. So "Tokyo works, others don't" means the trigger was
// either missing or disabled when the M12 imports ran (Prisma 7
// drift around location has fired multiple times — see KNOWN_ISSUES
// M2 / M6 / M7-P1 / M7-P1.5).
//
// This script is idempotent:
//   Phase 1 — diagnose: total / with_location / null_location counts,
//             trigger presence, GiST index presence
//   Phase 2 — ensure trigger + index (re-create if missing, no-op
//             otherwise; DROP TRIGGER IF EXISTS + CREATE is the same
//             pattern the migration uses)
//   Phase 3 — backfill NULL rows in batches of 10k (CTE with LIMIT,
//             loop until no rows changed) with progress
//   Phase 4 — post-diagnose: confirm 0 NULLs remain
//
// Usage:
//   DATABASE_URL='<prod URI>' pnpm prod:backfill-location
//
// Safety:
//   - read-only diagnosis prints before any write
//   - the UPDATE is idempotent (WHERE location IS NULL)
//   - trigger DDL uses IF EXISTS / OR REPLACE so re-running is a no-op
//   - batching prevents a single multi-minute transaction hogging locks

import { db } from '../src/server/db'

const BATCH_SIZE = 10_000

interface CountRow {
  total: bigint
  with_location: bigint
  null_location: bigint
}

interface TriggerRow {
  tgname: string
}

interface IndexRow {
  indexname: string
}

async function countRows(): Promise<CountRow> {
  const rows = await db.$queryRaw<CountRow[]>`
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(location)::bigint AS with_location,
      (COUNT(*) - COUNT(location))::bigint AS null_location
    FROM "Toilet"
  `
  return rows[0]
}

async function listTriggers(): Promise<string[]> {
  const rows = await db.$queryRaw<TriggerRow[]>`
    SELECT tgname FROM pg_trigger
    WHERE tgrelid = '"Toilet"'::regclass
      AND NOT tgisinternal
  `
  return rows.map((r) => r.tgname)
}

async function listGistIndexes(): Promise<string[]> {
  const rows = await db.$queryRaw<IndexRow[]>`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'Toilet'
      AND indexdef LIKE '%GIST%'
  `
  return rows.map((r) => r.indexname)
}

async function ensureTrigger(existing: string[]): Promise<boolean> {
  if (existing.includes('toilet_location_trigger')) return false

  console.log(`\n⚠️  toilet_location_trigger missing — recreating`)
  // Idempotent DDL mirroring prisma/migrations/20260419001746_add_spatial_
  // index_and_trigger/migration.sql. Kept in sync with that file; if the
  // migration ever changes, update this too.
  await db.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION update_toilet_location()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.location := ST_SetSRID(
        ST_MakePoint(NEW.longitude, NEW.latitude),
        4326
      )::geography;
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  `)
  await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS toilet_location_trigger ON "Toilet"`)
  await db.$executeRawUnsafe(`
    CREATE TRIGGER toilet_location_trigger
      BEFORE INSERT OR UPDATE OF latitude, longitude ON "Toilet"
      FOR EACH ROW
      EXECUTE FUNCTION update_toilet_location()
  `)
  console.log(`   ✓ trigger recreated`)
  return true
}

async function ensureIndex(existing: string[]): Promise<boolean> {
  if (existing.includes('toilet_location_idx')) return false

  console.log(`\n⚠️  toilet_location_idx missing — recreating`)
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS toilet_location_idx ON "Toilet" USING GIST (location)`,
  )
  console.log(`   ✓ index recreated`)
  return true
}

async function backfillBatched(nullCount: bigint): Promise<void> {
  if (nullCount === BigInt(0)) {
    console.log(`\n✅ No NULL location rows — backfill skipped`)
    return
  }

  console.log(`\n⚙️  Backfilling ${nullCount.toString()} NULL rows in batches of ${BATCH_SIZE}…`)
  const startTime = Date.now()
  let done = 0

  // CTE batching: PostgreSQL UPDATE doesn't accept LIMIT directly. Pick a
  // batch of ids in the CTE, join on them in the UPDATE, loop until 0.
  // Each iteration is its own transaction — no multi-minute lock holders.
  for (;;) {
    const affected = await db.$executeRaw`
      WITH batch AS (
        SELECT id FROM "Toilet"
        WHERE location IS NULL
        LIMIT ${BATCH_SIZE}
      )
      UPDATE "Toilet" t
      SET location = ST_SetSRID(ST_MakePoint(t.longitude, t.latitude), 4326)::geography
      FROM batch
      WHERE t.id = batch.id
    `
    if (affected === 0) break

    done += affected
    const pct = ((done / Number(nullCount)) * 100).toFixed(1)
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`   ${done}/${nullCount.toString()} (${pct}%) · ${elapsed}s`)
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\n✅ Backfill complete in ${totalTime}s`)
}

async function main() {
  console.log(`🧭 Toilet.location backfill\n`)

  if (!process.env.DATABASE_URL) {
    console.error(`✗ DATABASE_URL is required`)
    process.exit(1)
  }
  const hostMatch = process.env.DATABASE_URL.match(/@([^/?]+)/)
  console.log(`   Target: ${hostMatch?.[1] ?? '(unknown host)'}`)

  // ── Phase 1: pre-diagnosis ──
  console.log(`\n🔍 Pre-backfill diagnosis`)
  const pre = await countRows()
  console.log(`   Total rows:        ${pre.total.toString()}`)
  console.log(`   With location:     ${pre.with_location.toString()}`)
  console.log(`   NULL location:     ${pre.null_location.toString()}`)

  const triggersBefore = await listTriggers()
  console.log(`   Triggers on Toilet: ${triggersBefore.join(', ') || '(none)'}`)

  const gistBefore = await listGistIndexes()
  console.log(`   GiST indexes:      ${gistBefore.join(', ') || '(none)'}`)

  // ── Phase 2: ensure trigger + index ──
  const triggerRecreated = await ensureTrigger(triggersBefore)
  const indexRecreated = await ensureIndex(gistBefore)

  // ── Phase 3: backfill ──
  await backfillBatched(pre.null_location)

  // ── Phase 4: post-diagnosis ──
  console.log(`\n🔍 Post-backfill diagnosis`)
  const post = await countRows()
  console.log(`   Total rows:        ${post.total.toString()}`)
  console.log(`   With location:     ${post.with_location.toString()}`)
  console.log(`   NULL location:     ${post.null_location.toString()}`)

  console.log(`\n📋 Summary`)
  console.log(`   Trigger recreated: ${triggerRecreated ? 'yes' : 'no (already present)'}`)
  console.log(`   Index recreated:   ${indexRecreated ? 'yes' : 'no (already present)'}`)
  console.log(`   Rows repaired:     ${(pre.null_location - post.null_location).toString()}`)
  console.log(`   Remaining NULL:    ${post.null_location.toString()}`)

  if (post.null_location > BigInt(0)) {
    console.error(
      `\n✗ ${post.null_location.toString()} rows still NULL after backfill — investigate before accepting.`,
    )
    process.exit(2)
  }
  console.log(`\n✅ Done. Ming may hard-reload toirepo.com and zoom to any city to verify.`)
}

main()
  .catch((e) => {
    console.error('✗ Backfill failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
