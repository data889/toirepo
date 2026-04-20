// Overpass API client for fetching OSM data.
// Mirrors the r2/client.ts + anthropic/client.ts pattern: no 'server-only'
// marker so tsx scripts (osm-import-dryrun.ts, future osm-import.ts) can
// import the module transitively. Directory convention gates usage.

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter'

export interface OsmElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

export interface OverpassResponse {
  version: number
  generator: string
  osm3s: { timestamp_osm_base: string; copyright: string }
  elements: OsmElement[]
}

/**
 * Query Overpass API with an OQL (Overpass Query Language) string.
 *
 * Free tier allows ~25 queries/day and responses up to ~100MB. For
 * anything larger, split by bbox sub-regions.
 */
export async function queryOverpass(oql: string, signal?: AbortSignal): Promise<OverpassResponse> {
  const res = await fetch(OVERPASS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      // Overpass rejects Node's default fetch User-Agent with 406; any
      // identifying UA is fine per Overpass operator convention.
      'User-Agent': 'toirepo-osm-import/0.1 (https://github.com/data889/toirepo)',
      Accept: 'application/json',
    },
    body: `data=${encodeURIComponent(oql)}`,
    signal,
    // Overpass large queries can take tens of seconds; don't let default
    // fetch timeouts truncate.
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(
      `Overpass error: ${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 200)}` : ''}`,
    )
  }
  return (await res.json()) as OverpassResponse
}

// Tokyo 23 wards bounding box (slightly generous). Confirmed this frame
// contains Adachi in the north (~35.80) and Ota in the south (~35.52).
export const TOKYO_23_WARDS_BBOX = {
  south: 35.5,
  west: 139.55,
  north: 35.82,
  east: 139.95,
} as const

export function formatBbox(bbox: typeof TOKYO_23_WARDS_BBOX): string {
  return `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`
}
