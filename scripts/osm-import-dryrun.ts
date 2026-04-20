// CLI harness: fetches real OSM data for Tokyo 23 wards, maps to Toilet
// candidates, prints stats + samples, and checks coordinate overlap
// with existing seed Toilets. NO DB WRITES.
//
// Usage:
//   pnpm osm:dryrun

import { db } from '../src/server/db'
import { queryOverpass } from '../src/server/osm/client'
import { TOKYO_TOILETS_OQL } from '../src/server/osm/queries'
import { mapOsmElement, type OsmToiletCandidate } from '../src/server/osm/mapping'

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

async function main() {
  console.log('🌐 Querying Overpass API for Tokyo 23 wards...')
  console.log(`   Bbox: south=35.5, west=139.55, north=35.82, east=139.95`)
  console.log(`   OQL length: ${TOKYO_TOILETS_OQL.length} chars\n`)

  const start = Date.now()
  const response = await queryOverpass(TOKYO_TOILETS_OQL)
  const elapsed = Date.now() - start

  console.log(`⏱  Overpass returned in ${(elapsed / 1000).toFixed(1)}s`)
  console.log(`📦 Raw elements: ${response.elements.length}\n`)

  const candidates: OsmToiletCandidate[] = []
  let rejected = 0
  for (const el of response.elements) {
    const candidate = mapOsmElement(el)
    if (candidate) candidates.push(candidate)
    else rejected++
  }
  console.log(`✅ Valid toilet candidates: ${candidates.length}`)
  console.log(`❌ Rejected (no type, missing name, out-of-bbox): ${rejected}\n`)

  // Type distribution
  const typeCount: Record<string, number> = {}
  for (const c of candidates) typeCount[c.type] = (typeCount[c.type] ?? 0) + 1
  console.log('📊 Type distribution:')
  for (const [type, count] of Object.entries(typeCount).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${type.padEnd(10)} ${count}`)
  }

  // Name locale coverage
  let zhCount = 0
  let jaCount = 0
  let enCount = 0
  for (const c of candidates) {
    if (c.name['zh-CN']) zhCount++
    if (c.name.ja) jaCount++
    if (c.name.en) enCount++
  }
  const pct = (n: number) =>
    candidates.length === 0 ? '0.0' : ((n / candidates.length) * 100).toFixed(1)
  console.log('\n🌏 Name locale coverage:')
  console.log(`   zh-CN: ${zhCount} (${pct(zhCount)}%)`)
  console.log(`   ja:    ${jaCount} (${pct(jaCount)}%)`)
  console.log(`   en:    ${enCount} (${pct(enCount)}%)`)

  // Address coverage
  let addressCount = 0
  for (const c of candidates) {
    if (c.address.ja || c.address.en) addressCount++
  }
  console.log(`📫 Has address: ${addressCount} (${pct(addressCount)}%)`)

  // Sample up to 5 per type
  console.log('\n📋 Sample candidates (up to 5 per type):')
  for (const type of Object.keys(typeCount)) {
    const samples = candidates.filter((c) => c.type === type).slice(0, 5)
    console.log(`\n   ── ${type} ──`)
    for (const s of samples) {
      const nameStr = s.name.ja || s.name.en || s.name['zh-CN'] || '(no name)'
      const addrStr = s.address.ja || s.address.en || '(no address)'
      console.log(
        `   ${s.osmId.padEnd(22)} ${nameStr.substring(0, 42).padEnd(42)} @ ${s.latitude.toFixed(4)},${s.longitude.toFixed(4)}`,
      )
      if (addrStr !== '(no address)') {
        console.log(`   ${''.padEnd(22)} ${addrStr.substring(0, 80)}`)
      }
    }
  }

  // Conflict detection with existing Toilet rows (within 10m)
  console.log('\n🔍 Checking for coordinate overlaps with existing Toilets (within 10m)...')
  const existing = await db.toilet.findMany({
    select: { id: true, slug: true, latitude: true, longitude: true },
  })
  console.log(`   Existing toilets in DB: ${existing.length}`)

  // Only check first 200 candidates to keep runtime bounded; extrapolate
  // if needed. Full conflict pass happens in the real import.
  const CONFLICT_SAMPLE = Math.min(200, candidates.length)
  let conflicts = 0
  for (let i = 0; i < CONFLICT_SAMPLE; i++) {
    const c = candidates[i]
    for (const e of existing) {
      if (haversineMeters(c.latitude, c.longitude, e.latitude, e.longitude) < 10) {
        conflicts++
        console.log(
          `   ⚠️  ${c.osmId} (${c.name.ja || c.name.en || '—'}) @ ${c.latitude.toFixed(5)},${c.longitude.toFixed(5)}`,
        )
        console.log(
          `       overlaps seed ${e.slug} @ ${e.latitude.toFixed(5)},${e.longitude.toFixed(5)}`,
        )
        break
      }
    }
  }
  console.log(`   Conflicts in first ${CONFLICT_SAMPLE} candidates: ${conflicts}`)

  console.log('\n✅ Dry-run complete. No DB changes made.')
  console.log(`   Ready for production import via scripts/osm-import.ts (M11 P2).`)
}

main()
  .catch((e) => {
    console.error('❌ Dry-run failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
