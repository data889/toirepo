'use client'

import maplibregl from 'maplibre-gl'
import { Protocol } from 'pmtiles'

let registered = false

/**
 * Register the pmtiles:// protocol handler with MapLibre GL JS so any
 * source URL of the form `pmtiles://https://...` is fetched via HTTP
 * Range requests against a single PMTiles file.
 *
 * Idempotent: subsequent calls are no-ops. Safe on the server (returns
 * without doing anything if window is undefined) so this can be imported
 * from RSC-adjacent code without crashing.
 *
 * Must run before MapLibre instantiates a Map referencing pmtiles://.
 */
export function registerPmtilesProtocol(): void {
  if (registered) return
  if (typeof window === 'undefined') return

  const protocol = new Protocol()
  maplibregl.addProtocol('pmtiles', protocol.tile)
  registered = true
}
