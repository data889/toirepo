import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from 'maplibre-gl'

const TYPE_LABEL: Record<string, string> = {
  PUBLIC: '公共',
  MALL: '商场',
  KONBINI: '便利店',
  PURCHASE: '需消费',
}

const TYPE_COLOR: Record<string, string> = {
  PUBLIC: '#D4573A',
  MALL: '#2C6B8F',
  KONBINI: '#5C8A3A',
  PURCHASE: '#B8860B',
}

/**
 * Wire up click + hover handlers for the toilet layers added by
 * MapCanvas. Two layer ids must already exist on the map:
 * - toilet-unclustered (single-marker symbol layer)
 * - toilet-clusters (cluster circle layer)
 *
 * Per-feature data (id, slug, type, name, address) is read off
 * feature.properties — populated by toiletsToGeoJSON in
 * src/lib/map/toilet-geojson.ts. No mock-toilets lookup; popups work
 * for any source data with the same property shape.
 */
export function attachToiletClickHandlers(map: MapLibreMap): void {
  // Click on individual marker → popup
  map.on('click', 'toilet-unclustered', (e) => {
    if (!e.features || e.features.length === 0) return
    const feature = e.features[0]
    const props = feature.properties ?? {}
    const type = String(props.type ?? 'PUBLIC')
    const name = String(props.name ?? '')
    const address = String(props.address ?? '')

    const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number]
    const label = TYPE_LABEL[type] ?? type
    const color = TYPE_COLOR[type] ?? '#8A8578'

    const html = `
      <div class="toirepo-popup">
        <div class="toirepo-popup-badge" style="background:${color}">${escapeHtml(label)}</div>
        <h3 class="toirepo-popup-title">${escapeHtml(name)}</h3>
        <p class="toirepo-popup-address">${escapeHtml(address)}</p>
      </div>
    `

    new maplibregl.Popup({
      closeButton: false,
      closeOnClick: true,
      maxWidth: '260px',
    })
      .setLngLat(coords)
      .setHTML(html)
      .addTo(map)
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
