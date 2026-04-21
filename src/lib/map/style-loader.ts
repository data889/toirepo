import type { StyleSpecification } from 'maplibre-gl'

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL

/**
 * Load the toirepo-paper MapLibre style, substituting runtime placeholders.
 *
 * M10 P2 history:
 *  - First cut (Protomaps public sample URL): aborted after Ming hit a
 *    404 on first verification — Protomaps rotates their sample
 *    dataset snapshots without warning.
 *  - Rolled back to self-hosted R2 (tokyo.pmtiles, Tokyo-only).
 *    {{R2_PUBLIC_URL}} is substituted here at runtime so the same
 *    style JSON works across dev / preview / prod without a rebuild.
 *
 * Placeholders:
 *   {{R2_PUBLIC_URL}}  →  process.env.NEXT_PUBLIC_R2_PUBLIC_URL
 */
export async function loadToirepoStyle(): Promise<StyleSpecification> {
  if (!R2_PUBLIC_URL) {
    throw new Error(
      'NEXT_PUBLIC_R2_PUBLIC_URL is not set. Add it to .env.local (same value as R2_PUBLIC_URL).',
    )
  }

  const res = await fetch('/map-style/toirepo-paper.json')
  if (!res.ok) {
    throw new Error(`Failed to load map style: ${res.status} ${res.statusText}`)
  }

  const raw = await res.text()
  const substituted = raw.replace(/\{\{R2_PUBLIC_URL\}\}/g, R2_PUBLIC_URL)

  return JSON.parse(substituted) as StyleSpecification
}
