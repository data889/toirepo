import { type GeoJSONSource, type Map as MapLibreMap } from 'maplibre-gl'

/**
 * Wire up click + hover handlers for the toilet layers added by
 * MapCanvas. Two layer ids must already exist on the map:
 * - toilet-unclustered (single-marker symbol layer)
 * - toilet-clusters (cluster circle layer)
 *
 * The marker click hands the slug to `onToiletClick` so the caller
 * (MapCanvas) can decide what happens — currently opens the
 * ToiletDrawer via URL search-param sync. The Drawer fetches its own
 * data from tRPC; this module no longer composes popup HTML.
 */
export function attachToiletClickHandlers(
  map: MapLibreMap,
  onToiletClick: (slug: string) => void,
): void {
  map.on('click', 'toilet-unclustered', (e) => {
    if (!e.features || e.features.length === 0) return
    const feature = e.features[0]
    const slug = feature.properties?.slug as string | undefined
    if (slug) onToiletClick(slug)
  })

  map.on('mouseenter', 'toilet-unclustered', () => {
    map.getCanvas().style.cursor = 'pointer'
  })
  map.on('mouseleave', 'toilet-unclustered', () => {
    map.getCanvas().style.cursor = ''
  })

  // Click on cluster → zoom to expansion zoom
  map.on('click', 'toilet-clusters', async (e) => {
    if (!e.features || e.features.length === 0) return
    const feature = e.features[0]
    const clusterId = feature.properties?.cluster_id
    if (clusterId === undefined) return

    const source = map.getSource('toilets')
    if (!source || source.type !== 'geojson') return

    const zoom = await (source as GeoJSONSource).getClusterExpansionZoom(clusterId as number)

    map.easeTo({
      center: (feature.geometry as GeoJSON.Point).coordinates as [number, number],
      zoom,
      duration: 500,
    })
  })

  map.on('mouseenter', 'toilet-clusters', () => {
    map.getCanvas().style.cursor = 'pointer'
  })
  map.on('mouseleave', 'toilet-clusters', () => {
    map.getCanvas().style.cursor = ''
  })
}
