import type { StyleSpecification } from 'maplibre-gl'

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL

/**
 * Load the toirepo-paper MapLibre style, substituting runtime placeholders.
 *
 * Placeholders currently supported:
 * - {{R2_PUBLIC_URL}}  →  process.env.NEXT_PUBLIC_R2_PUBLIC_URL
 *
 * The style ships under public/map-style/ and is fetched at runtime
 * (rather than imported into the bundle) so that map basemap edits
 * don't require a rebuild.
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
