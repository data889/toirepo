import { resolveToiletAddress, resolveToiletName } from './toilet-labels'

// Subset of Toilet that toiletsToGeoJSON needs. Loose enough that
// either api.toilet.list output or a full Toilet row from Prisma is
// assignable.
export interface ToiletForMap {
  id: string
  slug: string
  type: string
  name: unknown
  address: unknown
  latitude: number
  longitude: number
}

// Properties carried on each Point Feature. Read by toilet-interactions
// click handlers and by the symbol layer's icon-image match expression.
export interface ToiletFeatureProps {
  id: string
  slug: string
  type: string
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
        name: resolveToiletName(t, locale),
        address: resolveToiletAddress(t, locale),
      },
    })),
  }
}
