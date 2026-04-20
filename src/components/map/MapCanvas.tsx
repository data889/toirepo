'use client'

import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useLocale } from 'next-intl'
import { loadToiletIcons } from '@/lib/map/load-icons'
import { registerPmtilesProtocol } from '@/lib/map/pmtiles-protocol'
import { loadToirepoStyle } from '@/lib/map/style-loader'
import { toiletsToGeoJSON, type ToiletForMap } from '@/lib/map/toilet-geojson'
import { attachToiletClickHandlers } from '@/lib/map/toilet-interactions'
import { api } from '@/lib/trpc/client'

// Tokyo Station — center of the MVP map. zoom 14 frames Chiyoda + Chuo.
const DEFAULT_CENTER: [number, number] = [139.7671, 35.6812]
const DEFAULT_ZOOM = 14

// Locked to the same bbox the T3.1 extract used. Beyond this there are
// no tiles to render.
const MAX_BOUNDS: [[number, number], [number, number]] = [
  [138.9, 35.3],
  [140.2, 35.95],
]

export interface MapCanvasProps {
  style?: React.CSSProperties
  className?: string
}

export function MapCanvas({ className, style }: MapCanvasProps) {
  const locale = useLocale()
  // Static fetch of all APPROVED toilets (cap 200). T4.3 design choice:
  // dataset is ~20 today and won't break 200 anytime soon. The setData
  // pipeline below is generic enough to take per-bbox refetch later.
  const toiletsQuery = api.toilet.list.useQuery(
    { limit: 200 },
    {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  )

  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  // Marks whether the GeoJSON source has been added during map.on('load').
  // setData calls before this is true would crash; the ref dance below
  // avoids that race.
  const sourceAddedRef = useRef(false)
  // Latest toilets snapshot for the map.on('load') handler — the load
  // closure captures the value at construction time, so we read from a
  // ref to get whatever's freshest at the moment load fires.
  const toiletsRef = useRef<ToiletForMap[] | undefined>(undefined)
  // Same for locale, in case the user changes locale before load fires.
  const localeRef = useRef(locale)

  const [error, setError] = useState<string | null>(null)

  // Mirror the React-state values into refs so non-React-tracked code
  // (the imperative MapLibre `load` callback) can read the latest.
  useEffect(() => {
    toiletsRef.current = toiletsQuery.data
  }, [toiletsQuery.data])
  useEffect(() => {
    localeRef.current = locale
  }, [locale])

  // When toilets data arrives or locale changes AND the source is
  // already on the map, push fresh data through setData.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !sourceAddedRef.current) return
    const toilets = toiletsQuery.data
    if (!toilets) return

    const source = map.getSource('toilets') as maplibregl.GeoJSONSource | undefined
    if (!source) return

    source.setData(toiletsToGeoJSON(toilets, locale))
  }, [toiletsQuery.data, locale])

  useEffect(() => {
    if (!containerRef.current) return
    if (mapRef.current) return // already initialized

    registerPmtilesProtocol()

    let cancelled = false

    const init = async () => {
      try {
        const style = await loadToirepoStyle()
        if (cancelled) return

        const map = new maplibregl.Map({
          container: containerRef.current!,
          style,
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          maxBounds: MAX_BOUNDS,
          attributionControl: false,
          dragRotate: false,
          touchPitch: false,
        })

        map.addControl(
          new maplibregl.AttributionControl({
            compact: true,
            customAttribution: [
              '<a href="https://openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>',
              '<a href="https://protomaps.com" target="_blank" rel="noopener">Protomaps</a>',
            ],
          }),
          'bottom-right',
        )

        map.addControl(
          new maplibregl.NavigationControl({
            showCompass: false,
            showZoom: true,
          }),
          'bottom-right',
        )

        map.addControl(
          new maplibregl.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: false,
            showUserLocation: true,
            showAccuracyCircle: false,
          }),
          'bottom-right',
        )

        map.on('load', async () => {
          if (cancelled) return
          try {
            await loadToiletIcons(map)

            // Add the source empty; data is pushed via setData below
            // (and via the toiletsQuery effect on subsequent updates).
            map.addSource('toilets', {
              type: 'geojson',
              data: { type: 'FeatureCollection', features: [] },
              cluster: true,
              clusterMaxZoom: 13,
              clusterRadius: 50,
            })

            map.addLayer({
              id: 'toilet-clusters',
              type: 'circle',
              source: 'toilets',
              filter: ['has', 'point_count'],
              paint: {
                'circle-color': '#2C6B8F',
                'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 30, 26],
                'circle-stroke-width': 2.5,
                'circle-stroke-color': '#FDFCF9',
              },
            })

            map.addLayer({
              id: 'toilet-cluster-count',
              type: 'symbol',
              source: 'toilets',
              filter: ['has', 'point_count'],
              layout: {
                'text-field': ['get', 'point_count_abbreviated'],
                'text-font': ['Noto Sans Regular'],
                'text-size': 13,
              },
              paint: {
                'text-color': '#FDFCF9',
              },
            })

            map.addLayer({
              id: 'toilet-unclustered',
              type: 'symbol',
              source: 'toilets',
              filter: ['!', ['has', 'point_count']],
              layout: {
                'icon-image': [
                  'match',
                  ['get', 'type'],
                  'PUBLIC',
                  'toilet-public',
                  'MALL',
                  'toilet-mall',
                  'KONBINI',
                  'toilet-konbini',
                  'PURCHASE',
                  'toilet-purchase',
                  'toilet-public',
                ],
                'icon-size': 1,
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
              },
            })

            attachToiletClickHandlers(map)
            sourceAddedRef.current = true

            // If toilets data already arrived before load completed,
            // push it now — the data-watching effect won't fire again
            // unless the data reference changes.
            const toilets = toiletsRef.current
            if (toilets) {
              const source = map.getSource('toilets') as maplibregl.GeoJSONSource | undefined
              if (source) {
                source.setData(toiletsToGeoJSON(toilets, localeRef.current))
              }
            }
          } catch (e) {
            console.error('Failed to initialize toilet layers:', e)
          }
        })

        mapRef.current = map
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e))
        }
      }
    }

    init()

    return () => {
      cancelled = true
      sourceAddedRef.current = false
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  if (error) {
    return (
      <div className={className} style={style}>
        <div className="bg-paper text-ink-primary p-6">
          <p className="text-sm font-medium">地图加载失败</p>
          <p className="text-ink-secondary mt-2 font-mono text-xs">{error}</p>
        </div>
      </div>
    )
  }

  return <div ref={containerRef} className={className} style={style} />
}
