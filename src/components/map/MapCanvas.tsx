'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useLocale } from 'next-intl'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { loadToiletIcons } from '@/lib/map/load-icons'
import { registerPmtilesProtocol } from '@/lib/map/pmtiles-protocol'
import { loadToirepoStyle } from '@/lib/map/style-loader'
import { toiletsToGeoJSON, type ToiletForMap } from '@/lib/map/toilet-geojson'
import { attachToiletClickHandlers } from '@/lib/map/toilet-interactions'
import { ToiletDrawer } from '@/components/toilet/ToiletDrawer'
import { SubmitFab } from '@/components/map/SubmitFab'
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

  // URL is the source of truth for "which toilet's drawer is open" — gives
  // shareable links and survives reloads. Marker clicks set `?t=slug`;
  // closing the drawer clears it.
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const openedSlug = searchParams.get('t')

  const setOpenedSlug = useCallback(
    (slug: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (slug) {
        params.set('t', slug)
      } else {
        params.delete('t')
      }
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [searchParams, router, pathname],
  )

  const toiletsQuery = api.toilet.list.useQuery(
    { limit: 2000 },
    {
      // Short staleTime as a fallback: the primary freshness signal is
      // explicit cache invalidation from /admin/queue (AdminQueueList
      // calls toilet.list.invalidate() on approve/reject). If that
      // signal is missed (cross-tab, hard reload), 30s keeps the map
      // from feeling stale for long.
      staleTime: 30 * 1000,
      refetchOnMount: 'always',
      refetchOnWindowFocus: false,
    },
  )

  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const sourceAddedRef = useRef(false)
  const toiletsRef = useRef<ToiletForMap[] | undefined>(undefined)
  const localeRef = useRef(locale)
  // setOpenedSlug is captured in the imperative MapLibre handler; if React
  // recreates the function (it does, on every searchParams change), we
  // want the latest version inside the closure.
  const setOpenedSlugRef = useRef(setOpenedSlug)

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    toiletsRef.current = toiletsQuery.data
  }, [toiletsQuery.data])
  useEffect(() => {
    localeRef.current = locale
  }, [locale])
  useEffect(() => {
    setOpenedSlugRef.current = setOpenedSlug
  }, [setOpenedSlug])

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
              paint: {
                // M7 P2.1: dim community-warning statuses in place
                // (CLOSED + NO_TOILET_HERE) so users see the marker is
                // there but a notice is attached. APPROVED stays full
                // opacity. REJECTED/HIDDEN never reach the layer —
                // toilet.list filters them out server-side.
                'icon-opacity': [
                  'match',
                  ['get', 'status'],
                  'CLOSED',
                  0.4,
                  'NO_TOILET_HERE',
                  0.4,
                  1,
                ],
              },
            })

            attachToiletClickHandlers(map, (slug) => setOpenedSlugRef.current(slug))
            sourceAddedRef.current = true

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

  return (
    <>
      <div ref={containerRef} className={className} style={style} />
      <ToiletDrawer slug={openedSlug} onClose={() => setOpenedSlug(null)} />
      <SubmitFab />
    </>
  )
}
