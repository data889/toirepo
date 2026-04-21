// Global OSM toilet import, continent-by-continent.
//
// Companion to scripts/osm-import.ts (Tokyo-focused). This one
// targets amenity=toilets ONLY (no shop/mall expansion — global
// shops have inconsistent toilet-access semantics, Tokyo's
// convenience-store assumption doesn't generalize). Expected
// 300k-400k rows worldwide per OSM 2024 density.
//
// Strategy: split the world into 7 regional bboxes, run each
// Overpass query sequentially with a 30s cooldown, cache each
// region's raw response to logs/ for resume-after-interrupt, then
// upsert via the same osmId-keyed flow as the Tokyo script.
//
// Usage:
//   DATABASE_URL='...' pnpm osm:import-global
//   DATABASE_URL='...' pnpm osm:import-global --regions=oceania
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

// 7 continental bboxes. Ordering: smallest first so early interrupts
// still capture at least the low-volume regions. Asia covers
// Tokyo/Japan already-imported rows — upsert handles the overlap.
const REGIONS: Region[] = [
  { name: 'oceania', bbox: [-48, 110, 0, 180] },
  { name: 'south_america', bbox: [-56, -85, 15, -34] },
  { name: 'africa', bbox: [-35, -20, 38, 55] },
  { name: 'north_america', bbox: [15, -170, 72, -50] },
  { name: 'europe', bbox: [35, -30, 72, 50] },
  { name: 'russia_east', bbox: [40, 25, 72, 180] },
  { name: 'asia', bbox: [-12, 25, 55, 180] },
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
  return `[out:json][timeout:300];
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
        const nameSource = c.name.en || c.name.ja || c.name['zh-CN'] || 'toilet'
        const baseSlug = slugify(nameSource) || 'toilet'
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
