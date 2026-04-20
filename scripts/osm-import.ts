// Production OSM import. Fetches Tokyo 23-wards data via Overpass, maps
// to Toilet candidates, skips anything within 10m of an existing non-OSM
// Toilet (preserving user submissions + seed), and upserts the rest with
// status=APPROVED + osmId for idempotent re-runs.
//
// Usage:
//   pnpm osm:import            # actual import
//   pnpm osm:import:dryrun     # same flow, no DB writes

import { db } from '../src/server/db'
import { queryOverpass } from '../src/server/osm/client'
import { TOKYO_TOILETS_OQL } from '../src/server/osm/queries'
import { mapOsmElement, type OsmToiletCandidate } from '../src/server/osm/mapping'

const BATCH_SIZE = 100
const CONFLICT_RADIUS_M = 10

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

interface ExistingRow {
  id: string
  slug: string
  latitude: number
  longitude: number
  osmId: string | null
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  console.log(`🌐 Fetching Overpass data${dryRun ? ' (DRY RUN)' : ''}...`)
  const response = await queryOverpass(TOKYO_TOILETS_OQL)
  console.log(`📦 Raw elements: ${response.elements.length}`)

  const candidates: OsmToiletCandidate[] = []
  for (const el of response.elements) {
    const c = mapOsmElement(el)
    if (c) candidates.push(c)
  }
  console.log(`✅ Valid candidates: ${candidates.length}`)

  console.log(`🔍 Loading existing Toilets for conflict detection...`)
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

  // Spatial grid for O(candidates × ~9) conflict checking instead of
  // O(candidates × existing). Bin at ~0.001° (~100m at Tokyo latitude);
  // a 3×3 bin window covers the 10m conflict radius with room to spare.
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
          // Same OSM id → we'll upsert, not treat as a conflict.
          if (e.osmId === c.osmId) continue
          // Existing OSM row at the same spot → not a "user wins" case;
          // let upsert overwrite if it's the same osmId (handled above)
          // or skip if it's a different osmId (data quality issue,
          // user/seed protection doesn't apply). Simplest: skip.
          if (e.osmId) continue
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
  for (const c of candidates) {
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
  console.log(`   Total candidates:          ${candidates.length}`)
  console.log(`   Already imported (upsert): ${alreadyImportedCount}`)
  console.log(`   10m conflicts (skip):      ${conflictCount}`)
  console.log(`   Net new inserts:           ${toUpsert.length - alreadyImportedCount}`)
  console.log(`   Total upsert operations:   ${toUpsert.length}`)

  if (dryRun) {
    console.log(`\n✅ DRY RUN complete. No DB changes.`)
    await db.$disconnect()
    return
  }

  console.log(`\n⚙️  Upserting in batches of ${BATCH_SIZE}...`)
  const startTime = Date.now()
  let done = 0
  let lastReport = 0

  for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
    const batch = toUpsert.slice(i, i + BATCH_SIZE)

    await Promise.all(
      batch.map(async (c) => {
        const nameSource = c.name.en || c.name.ja || c.name['zh-CN'] || 'toilet'
        const baseSlug = slugify(nameSource) || 'toilet'
        // osmId suffix guarantees uniqueness even when baseSlug collapses
        // to 'toilet' (Japanese-only names strip to empty after slugify).
        const osmIdShort = c.osmId.replace(/\//g, '-')
        const slug = `${baseSlug}-${osmIdShort}`.slice(0, 80)

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
            // Don't overwrite slug or status — preserve any admin state.
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
    if (done - lastReport >= 500 || done === toUpsert.length) {
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
    console.error('❌ Import failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
