// OSM element → Toilet candidate mapping.
//
// Pure functions, no I/O. The caller (dry-run CLI or future import
// script) iterates Overpass response elements and either drops them
// (inferToiletType returns null) or builds a Toilet candidate record.

import type { OsmElement } from './client'

export interface OsmToiletCandidate {
  osmId: string // e.g. "node/123456789" or "way/987654321"
  latitude: number
  longitude: number
  type: 'PUBLIC' | 'MALL' | 'KONBINI' | 'PURCHASE'
  name: { 'zh-CN'?: string; ja?: string; en?: string }
  address: { 'zh-CN'?: string; ja?: string; en?: string }
  rawTags: Record<string, string>
}

/**
 * Derive Toilet.type from OSM tags.
 * Reference: https://wiki.openstreetmap.org/wiki/Key:amenity
 */
export function inferToiletType(tags: Record<string, string>): OsmToiletCandidate['type'] | null {
  if (tags.amenity === 'toilets') return 'PUBLIC'
  if (tags.shop === 'convenience') return 'KONBINI'
  if (tags.shop === 'mall' || tags.shop === 'department_store') return 'MALL'
  // Cafes / restaurants excluded from this pass — see queries.ts note.
  return null
}

/**
 * Build multi-locale name from OSM tags.
 *
 * OSM convention in Japan: `name` is the Japanese canonical name.
 * name:ja may duplicate `name`. name:en / name:zh are optional and rare.
 */
export function buildName(
  tags: Record<string, string>,
  type: OsmToiletCandidate['type'],
): OsmToiletCandidate['name'] {
  const result: OsmToiletCandidate['name'] = {}

  const zh = tags['name:zh'] || tags['name:zh-Hans'] || tags['name:zh-CN']
  if (zh) result['zh-CN'] = zh

  const ja = tags['name:ja'] || tags.name
  if (ja) result.ja = ja

  const en = tags['name:en']
  if (en) result.en = en

  // Fallback for PUBLIC toilets without any name — they're still useful
  // pins on the map and the type alone conveys the core info. Non-PUBLIC
  // without a name (unnamed konbini / mall) is too ambiguous to keep.
  if (!result.ja && !result.en && !result['zh-CN']) {
    if (type === 'PUBLIC') {
      result.ja = '公衆トイレ'
      result.en = 'Public toilet'
      result['zh-CN'] = '公共厕所'
    }
  }

  return result
}

/**
 * Build multi-locale address from OSM addr:* tags.
 *
 * Japan OSM commonly uses a subset of:
 *   addr:province / addr:state  — 都道府県
 *   addr:city                    — 市区町村
 *   addr:suburb / addr:quarter   — 町丁目 (higher-order)
 *   addr:neighbourhood           — 番地近隣
 *   addr:block_number            — 街区番号
 *   addr:housenumber             — 号
 *   addr:street                  — street (rare in Japan)
 *
 * We concatenate whatever's present, in that order, as the ja address.
 * EN/ZH only set when explicit :en / :zh variants exist (rare).
 */
export function buildAddress(tags: Record<string, string>): OsmToiletCandidate['address'] {
  const parts: string[] = []
  const push = (v?: string) => {
    if (v && v.trim().length > 0) parts.push(v)
  }

  push(tags['addr:province'] || tags['addr:state'])
  push(tags['addr:city'])
  push(tags['addr:suburb'])
  push(tags['addr:quarter'])
  push(tags['addr:neighbourhood'])
  push(tags['addr:block_number'])
  push(tags['addr:housenumber'])
  push(tags['addr:street'])

  const ja = parts.join(' ').trim()
  const en = tags['addr:full:en'] || ''

  return {
    ja: ja || undefined,
    en: en || undefined,
    // zh-CN intentionally left empty — M8 DeepL pass can backfill.
  }
}

/**
 * Map an OSM element to a toilet candidate.
 * Returns null if element is not a valid toilet candidate.
 */
export function mapOsmElement(el: OsmElement): OsmToiletCandidate | null {
  const tags = el.tags ?? {}

  const type = inferToiletType(tags)
  if (!type) return null

  // Nodes carry lat/lon directly; ways/relations carry a `center` from
  // Overpass's `out center;` directive.
  const lat = el.lat ?? el.center?.lat
  const lon = el.lon ?? el.center?.lon
  if (lat == null || lon == null) return null

  // Tokyo bbox guard — drops anything that slipped in via overly generous
  // Overpass bbox rounding.
  if (lat < 35.4 || lat > 35.9 || lon < 139.5 || lon > 140.0) return null

  const name = buildName(tags, type)
  const address = buildAddress(tags)

  // Non-PUBLIC without a name: drop — unnamed konbini/mall is unusable.
  const hasName = Object.values(name).some((v) => typeof v === 'string' && v.length > 0)
  if (!hasName) return null

  return {
    osmId: `${el.type}/${el.id}`,
    latitude: lat,
    longitude: lon,
    type,
    name,
    address,
    rawTags: tags,
  }
}
