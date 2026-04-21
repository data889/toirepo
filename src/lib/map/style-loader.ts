import type { StyleSpecification } from 'maplibre-gl'

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY
const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL

// Chosen style id. basic-v2-light reads as a muted, paper-like
// basemap — closest to the hand-drawn aesthetic of the original
// toirepo-paper.json and plays nicely with the 4-color toilet marker
// palette. If Ming wants to try streets-v2 / bright-v2 / toner-v2 /
// topo-v2 later, swap the string below.
const MAPTILER_STYLE_ID = 'basic-v2-light'

export interface LoadedStyle {
  /** The StyleSpecification object MapLibre consumes. */
  style: StyleSpecification
  /** 'maptiler' = global coverage via MapTiler free tier.
   *  'r2' = self-hosted tokyo.pmtiles fallback (Kanto bbox only). */
  source: 'maptiler' | 'r2'
}

/**
 * Load the active basemap style. Two paths:
 *
 *  1. `NEXT_PUBLIC_MAPTILER_KEY` set → fetch MapTiler's hosted
 *     style.json. Global coverage, MapTiler + OSM attribution baked
 *     into the returned style so MapLibre's AttributionControl
 *     renders it automatically.
 *  2. No key → fall back to the self-hosted R2 tokyo.pmtiles style.
 *     Keeps local dev working without MapTiler signup; keeps prod
 *     usable if the key expires or gets rate-limited. Tokyo-only
 *     coverage — caller is expected to enforce MAX_BOUNDS.
 *
 * The `source` field in the return tells MapCanvas which path was
 * taken so it can conditionally apply MAX_BOUNDS.
 */
export async function loadToirepoStyle(): Promise<LoadedStyle> {
  if (MAPTILER_KEY) {
    const url = `https://api.maptiler.com/maps/${MAPTILER_STYLE_ID}/style.json?key=${MAPTILER_KEY}`
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`Failed to load MapTiler style: ${res.status} ${res.statusText}`)
    }
    const style = (await res.json()) as StyleSpecification
    return { style, source: 'maptiler' }
  }

  if (!R2_PUBLIC_URL) {
    throw new Error(
      'No basemap configured. Set NEXT_PUBLIC_MAPTILER_KEY (preferred, global coverage) or NEXT_PUBLIC_R2_PUBLIC_URL (Tokyo-only fallback).',
    )
  }

  const res = await fetch('/map-style/toirepo-paper.json')
  if (!res.ok) {
    throw new Error(`Failed to load fallback style: ${res.status} ${res.statusText}`)
  }
  const raw = await res.text()
  const substituted = raw.replace(/\{\{R2_PUBLIC_URL\}\}/g, R2_PUBLIC_URL)
  return { style: JSON.parse(substituted) as StyleSpecification, source: 'r2' }
}
