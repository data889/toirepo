'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useLocale, useTranslations } from 'next-intl'
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

// Applied only when falling back to self-hosted R2 tokyo.pmtiles
// (Kanto bbox only — no tiles outside). MapTiler path skips this:
// global coverage, user pans to Beijing / NYC / London freely.
const R2_FALLBACK_MAX_BOUNDS: [[number, number], [number, number]] = [
  [138.9, 35.3],
  [140.2, 35.95],
]

export interface MapCanvasProps {
  style?: React.CSSProperties
  className?: string
}

// M12 debug: temporary logging to diagnose "backend returns N rows,
// no markers render" path. Remove once Ming's console trace pinpoints
// the stuck step. Grep browser console for [MapCanvas].
const DBG = '[MapCanvas]'

export function MapCanvas({ className, style }: MapCanvasProps) {
  const locale = useLocale()
  const tMap = useTranslations('map')

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

  // M12: viewport state drives the bbox-scoped tRPC query below. null
  // until the map emits its first post-load moveend; after that, each
  // pan/zoom/idle tick schedules an update (debounced — see scheduleViewportSync).
  const [viewport, setViewport] = useState<{
    bbox: [number, number, number, number]
    zoom: number
  } | null>(null)

  // Below this zoom the viewport spans most of the planet — a single
  // query would either hit the 5000-row limit instantly or miss whole
  // regions. Surface an onboarding hint instead (next commit) and
  // skip the fetch.
  const MIN_FETCH_ZOOM = 3
  const shouldFetch = !!viewport && viewport.zoom >= MIN_FETCH_ZOOM

  const toiletsQuery = api.toilet.listByBbox.useQuery(
    shouldFetch
      ? {
          minLng: viewport.bbox[0],
          minLat: viewport.bbox[1],
          maxLng: viewport.bbox[2],
          maxLat: viewport.bbox[3],
          zoom: viewport.zoom,
          limit: 2000,
        }
      : // When disabled, input is ignored by tRPC. The placeholder
        // satisfies the type without being sent.
        {
          minLng: 0,
          minLat: 0,
          maxLng: 0,
          maxLat: 0,
          zoom: 0,
          limit: 2000,
        },
    {
      enabled: shouldFetch,
      // 5 min across the same viewport — React Query dedupes exact
      // bbox matches (user panning back and forth). Admin approvals
      // invalidate the full key so freshness still works that path.
      staleTime: 5 * 60 * 1000,
      refetchOnMount: 'always',
      refetchOnWindowFocus: false,
    },
  )

  // DBG: render-time snapshot. Fires on every React render so is
  // noisy — grep for specific transitions. In prod builds the tRPC
  // loggerLink is disabled (gated on NODE_ENV==='development'), so
  // the error.message below is the PRIMARY surface for query errors.
  const errObj = toiletsQuery.error as unknown
  const errData =
    errObj && typeof errObj === 'object' && 'data' in errObj
      ? (errObj as { data?: unknown }).data
      : null
  console.log(DBG, 'render', {
    shouldFetch,
    viewport,
    dataRaw:
      toiletsQuery.data === undefined
        ? 'UNDEFINED'
        : toiletsQuery.data === null
          ? 'NULL'
          : `array(${(toiletsQuery.data as unknown[]).length})`,
    isFetching: toiletsQuery.isFetching,
    isSuccess: toiletsQuery.isSuccess,
    isError: toiletsQuery.isError,
    errorMessage: toiletsQuery.error?.message,
    errorData: errData,
    errorName:
      toiletsQuery.error && typeof toiletsQuery.error === 'object'
        ? toiletsQuery.error.constructor?.name
        : null,
  })

  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const sourceAddedRef = useRef(false)
  const toiletsRef = useRef<ToiletForMap[] | undefined>(undefined)
  const localeRef = useRef(locale)
  // setOpenedSlug is captured in the imperative MapLibre handler; if React
  // recreates the function (it does, on every searchParams change), we
  // want the latest version inside the closure.
  const setOpenedSlugRef = useRef(setOpenedSlug)
  // Debounce handle for viewport sync (moveend fires many times during
  // a single pan; we only care about the settled state).
  const viewportDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    toiletsRef.current = toiletsQuery.data
  }, [toiletsQuery.data])

  // DBG: side-by-side raw fetch against the same endpoint using
  // plain XHR. Bypasses tRPC client / loggerLink / superjson
  // decoding. If RAW FETCH prints a populated `json` array but
  // the `render` log shows dataRaw=UNDEFINED, the issue is in
  // the tRPC client layer (streaming link / transformer).
  useEffect(() => {
    if (!viewport) return
    const input = {
      '0': {
        json: {
          minLng: viewport.bbox[0],
          minLat: viewport.bbox[1],
          maxLng: viewport.bbox[2],
          maxLat: viewport.bbox[3],
          zoom: viewport.zoom,
          limit: 2000,
        },
      },
    }
    const url = `/api/trpc/toilet.listByBbox?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`
    console.log(DBG, 'raw-fetch firing', { url: url.slice(0, 120) + '…' })
    fetch(url)
      .then((r) => {
        console.log(DBG, 'raw-fetch http', { status: r.status, ok: r.ok })
        return r.text().then((text) => ({ text, status: r.status }))
      })
      .then(({ text, status }) => {
        let parsed: unknown = null
        try {
          parsed = JSON.parse(text)
        } catch (e) {
          console.log(DBG, 'raw-fetch JSON.parse threw', {
            status,
            textHead: text.slice(0, 200),
            err: (e as Error).message,
          })
          return
        }
        const top = Array.isArray(parsed) ? parsed[0] : parsed
        const json =
          top &&
          typeof top === 'object' &&
          'result' in top &&
          (top as { result?: { data?: { json?: unknown } } }).result?.data?.json
        const err =
          top && typeof top === 'object' && 'error' in top
            ? (top as { error?: unknown }).error
            : null
        console.log(DBG, 'raw-fetch parsed', {
          isArray: Array.isArray(parsed),
          jsonIsArray: Array.isArray(json),
          jsonLength: Array.isArray(json) ? json.length : null,
          jsonFirst: Array.isArray(json) && json.length > 0 ? json[0] : null,
          errPresent: !!err,
          err,
        })
      })
      .catch((e) => console.log(DBG, 'raw-fetch network error', e))
  }, [viewport])
  useEffect(() => {
    localeRef.current = locale
  }, [locale])
  useEffect(() => {
    setOpenedSlugRef.current = setOpenedSlug
  }, [setOpenedSlug])

  useEffect(() => {
    const map = mapRef.current
    const hasMap = !!map
    const sourceReady = sourceAddedRef.current
    const toilets = toiletsQuery.data
    console.log(DBG, 'data-effect', {
      hasMap,
      sourceReady,
      dataCount: toilets?.length,
      locale,
    })
    if (!map || !sourceReady) {
      console.log(DBG, 'data-effect skip: map or source not ready')
      return
    }
    if (!toilets) {
      console.log(DBG, 'data-effect skip: data undefined (query in flight?)')
      return
    }

    const source = map.getSource('toilets') as maplibregl.GeoJSONSource | undefined
    console.log(DBG, 'source lookup', { found: !!source })
    if (!source) return

    const geojson = toiletsToGeoJSON(toilets, locale)
    console.log(DBG, 'setData about to fire', {
      featureCount: geojson.features.length,
      firstFeature: geojson.features[0],
    })
    try {
      source.setData(geojson)
      console.log(DBG, 'setData returned OK')
    } catch (e) {
      console.error(DBG, 'setData threw', e)
    }
  }, [toiletsQuery.data, locale])

  useEffect(() => {
    if (!containerRef.current) return
    if (mapRef.current) return // already initialized

    registerPmtilesProtocol()

    let cancelled = false

    const init = async () => {
      try {
        const { style, source } = await loadToirepoStyle()
        if (cancelled) return

        const map = new maplibregl.Map({
          container: containerRef.current!,
          style,
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          // Bound the camera only when we're on the Tokyo-only R2
          // fallback; MapTiler has global coverage so the user can
          // pan to any city.
          ...(source === 'r2' ? { maxBounds: R2_FALLBACK_MAX_BOUNDS } : {}),
          // Don't render repeating copies of the world when zoomed
          // far out. Without this, zoom 0-1 shows two Tokyos
          // horizontally (and toilet markers double-render). Paired
          // with minZoom=2 so users can't reach the zoom where the
          // wrap would be geometrically forced.
          renderWorldCopies: false,
          minZoom: 2,
          attributionControl: false,
          dragRotate: false,
          touchPitch: false,
        })

        // Attribution is read by MapLibre from the style's
        // sources.*.attribution fields — both MapTiler's style.json
        // (returns "© MapTiler © OpenStreetMap contributors") and our
        // own toirepo-paper.json (Protomaps + OSM) already carry the
        // right text, so AttributionControl needs no customAttribution
        // array from us.
        map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')

        map.addControl(
          new maplibregl.NavigationControl({
            showCompass: false,
            showZoom: true,
          }),
          'bottom-right',
        )

        // M10 P2: trackUserLocation=true keeps the camera re-centered
        // on the user as they move. Upstream maplibre-gl 5.x does NOT
        // expose `showUserHeading` (a Mapbox GL-only option) — the
        // user-location indicator renders as a plain dot, not an
        // orientation arrow. Custom DeviceOrientation-driven arrow
        // is tracked in KNOWN_ISSUES as an M12 polish.
        map.addControl(
          new maplibregl.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: true,
            showUserLocation: true,
            showAccuracyCircle: false,
          }),
          'bottom-right',
        )

        // M12: settle-based viewport sync. moveend fires on every pan
        // tick during a drag; 500ms debounce collapses those into one
        // setViewport when the user lets go. An initial call is made
        // after map.load so the first render has data without waiting
        // for user interaction.
        const syncViewport = () => {
          const b = map.getBounds()
          const next = {
            bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()] as [
              number,
              number,
              number,
              number,
            ],
            zoom: map.getZoom(),
          }
          console.log(DBG, 'syncViewport', next)
          setViewport(next)
        }
        const scheduleViewportSync = () => {
          console.log(DBG, 'moveend → scheduleViewportSync (500ms debounce)')
          if (viewportDebounceRef.current) clearTimeout(viewportDebounceRef.current)
          viewportDebounceRef.current = setTimeout(syncViewport, 500)
        }

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
            console.log(DBG, 'map load complete, source + layers ready')

            const toilets = toiletsRef.current
            if (toilets) {
              const source = map.getSource('toilets') as maplibregl.GeoJSONSource | undefined
              if (source) {
                console.log(DBG, 'load-time replay of stale toiletsRef', {
                  count: toilets.length,
                })
                source.setData(toiletsToGeoJSON(toilets, localeRef.current))
              }
            }

            // Kick off the first viewport fetch now that layers + click
            // handlers are ready. Subsequent settled views piggyback on
            // moveend.
            syncViewport()
            map.on('moveend', scheduleViewportSync)
          } catch (e) {
            console.error(DBG, 'Failed to initialize toilet layers:', e)
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
      if (viewportDebounceRef.current) {
        clearTimeout(viewportDebounceRef.current)
        viewportDebounceRef.current = null
      }
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

  // M12: below MIN_FETCH_ZOOM the viewport is whole-earth and one query
  // would either hit the 5000-row limit instantly or miss regions; show
  // a pill prompt instead. Since renderWorldCopies: false + minZoom: 2
  // clamp the camera, this effectively fires only at zoom 2.
  const showZoomHint = !!viewport && viewport.zoom < MIN_FETCH_ZOOM

  return (
    <>
      <div ref={containerRef} className={className} style={style} />
      {showZoomHint && (
        // Inline position because Tailwind utilities don't cascade
        // reliably over the map tree (see KNOWN_ISSUES M3 T3.4).
        <div
          role="status"
          className="bg-ink-primary/85 text-paper pointer-events-none rounded-full px-4 py-2 text-sm font-medium shadow-lg backdrop-blur-sm"
          style={{
            position: 'absolute',
            top: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
          }}
        >
          {tMap('zoomHint')}
        </div>
      )}
      <ToiletDrawer slug={openedSlug} onClose={() => setOpenedSlug(null)} />
      <SubmitFab />
    </>
  )
}
