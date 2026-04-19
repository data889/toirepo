'use client'

import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { loadToiletIcons } from '@/lib/map/load-icons'
import { MOCK_TOILETS } from '@/lib/map/mock-toilets'
import { registerPmtilesProtocol } from '@/lib/map/pmtiles-protocol'
import { loadToirepoStyle } from '@/lib/map/style-loader'
import { attachToiletClickHandlers } from '@/lib/map/toilet-interactions'

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
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [error, setError] = useState<string | null>(null)

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

            const geojson: GeoJSON.FeatureCollection<
              GeoJSON.Point,
              { id: string; type: string; name: string }
            > = {
              type: 'FeatureCollection',
              features: MOCK_TOILETS.map((t) => ({
                type: 'Feature',
                id: t.id,
                geometry: { type: 'Point', coordinates: [t.lng, t.lat] },
                properties: { id: t.id, type: t.type, name: t.name },
              })),
            }

            map.addSource('toilets', {
              type: 'geojson',
              data: geojson,
              cluster: true,
              clusterMaxZoom: 13,
              clusterRadius: 50,
            })

            // Cluster circle (zoom ≤ 13)
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

            // Cluster count text
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

            // Individual markers (zoom ≥ 14, when clusters dissolve)
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
                'icon-size': 0.75,
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
              },
            })

            attachToiletClickHandlers(map)
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
