import { resolveToiletAddress, resolveToiletName } from './toilet-labels'

// Subset of Toilet that toiletsToGeoJSON needs. Loose enough that
// either api.toilet.list output or a full Toilet row from Prisma is
// assignable.
//
// M7 P2.1: status added so the MapLibre symbol layer can apply a
// filter / icon-opacity expression for CLOSED + NO_TOILET_HERE
// (community-warning states that stay visible but dimmed).
export interface ToiletForMap {
  id: string
  slug: string
  type: string
  status?: string
  name: unknown
  address: unknown
  latitude: number
  longitude: number
}

// Properties carried on each Point Feature. Read by toilet-interactions
// click handlers and by the symbol layer's icon-image / icon-opacity
// expressions.
export interface ToiletFeatureProps {
  id: string
  slug: string
  type: string
  status: string
  name: string
  address: string
}

export function toiletsToGeoJSON(
  toilets: ToiletForMap[],
  locale: string,
): GeoJSON.FeatureCollection<GeoJSON.Point, ToiletFeatureProps> {
  return {
    type: 'FeatureCollection',
    features: toilets.map((t) => ({
      type: 'Feature',
      id: t.id,
      geometry: { type: 'Point', coordinates: [t.longitude, t.latitude] },
      properties: {
        id: t.id,
        slug: t.slug,
        type: String(t.type),
        // Default APPROVED for any caller that doesn't pass status —
        // preserves backward compat (older M11 import script doesn't
        // set status on its in-memory rows). Visual treatment for
        // missing status is the same as APPROVED.
        status: String(t.status ?? 'APPROVED'),
        name: resolveToiletName(t, locale),
        address: resolveToiletAddress(t, locale),
      },
    })),
  }
}
