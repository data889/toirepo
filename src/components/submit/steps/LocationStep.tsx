'use client'

import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useTranslations } from 'next-intl'
import { Crosshair, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { registerPmtilesProtocol } from '@/lib/map/pmtiles-protocol'
import { loadToirepoStyle } from '@/lib/map/style-loader'

// Tokyo Station — same default frame as MapCanvas so first render feels
// consistent with the main map.
const DEFAULT_CENTER: [number, number] = [139.7671, 35.6812]
const DEFAULT_ZOOM = 14

interface LocationStepProps {
  latitude: number | null
  longitude: number | null
  onChange: (lat: number, lng: number) => void
}

export function LocationStep({ latitude, longitude, onChange }: LocationStepProps) {
  const t = useTranslations('submit.location')
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const onChangeRef = useRef(onChange)
  const [geolocating, setGeolocating] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!containerRef.current) return
    if (mapRef.current) return

    registerPmtilesProtocol()
    let cancelled = false

    ;(async () => {
      try {
        const { style } = await loadToirepoStyle()
        if (cancelled || !containerRef.current) return

        const map = new maplibregl.Map({
          container: containerRef.current,
          style,
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          attributionControl: false,
          dragRotate: false,
          touchPitch: false,
        })
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

        map.on('click', (e) => {
          onChangeRef.current(e.lngLat.lat, e.lngLat.lng)
        })

        mapRef.current = map
      } catch (e) {
        if (!cancelled) setMapError(e instanceof Error ? e.message : String(e))
      }
    })()

    return () => {
      cancelled = true
      if (markerRef.current) {
        markerRef.current.remove()
        markerRef.current = null
      }
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (latitude === null || longitude === null) {
      markerRef.current?.remove()
      markerRef.current = null
      return
    }

    if (!markerRef.current) {
      markerRef.current = new maplibregl.Marker({ color: '#D4573A' })
        .setLngLat([longitude, latitude])
        .addTo(map)
    } else {
      markerRef.current.setLngLat([longitude, latitude])
    }
  }, [latitude, longitude])

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      alert(t('geolocationUnsupported'))
      return
    }
    setGeolocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChangeRef.current(pos.coords.latitude, pos.coords.longitude)
        mapRef.current?.flyTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 17,
        })
        setGeolocating(false)
      },
      (err) => {
        console.error('Geolocation failed:', err)
        alert(t('geolocationFailed'))
        setGeolocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  return (
    <section className="space-y-3">
      <h2 className="text-ink-primary text-lg font-medium">{t('title')}</h2>
      <p className="text-ink-secondary text-sm">{t('hint')}</p>

      {mapError ? (
        <div className="border-border-soft bg-paper-deep text-ink-secondary rounded border p-4 text-sm">
          {t('mapError')}: {mapError}
        </div>
      ) : (
        <div
          ref={containerRef}
          className="border-border-soft w-full overflow-hidden rounded border"
          style={{ height: '16rem' }}
        />
      )}

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={useCurrentLocation}
          disabled={geolocating || !!mapError}
          size="sm"
        >
          <Crosshair className="mr-1 h-4 w-4" />
          {geolocating ? t('geolocating') : t('useCurrentLocation')}
        </Button>

        {latitude !== null && longitude !== null ? (
          <div className="text-ink-tertiary font-mono text-xs">
            <MapPin className="mr-1 inline h-3 w-3" />
            {latitude.toFixed(5)}, {longitude.toFixed(5)}
          </div>
        ) : (
          <div className="text-ink-tertiary text-xs">{t('notSelected')}</div>
        )}
      </div>
    </section>
  )
}
