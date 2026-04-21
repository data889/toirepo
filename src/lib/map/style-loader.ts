import type { StyleSpecification } from 'maplibre-gl'

/**
 * Load the toirepo-paper MapLibre style.
 *
 * M10 P2: basemap source switched from self-hosted R2 (tokyo.pmtiles)
 * to the Protomaps public sample dataset. The style JSON now has a
 * hardcoded pmtiles URL — no runtime env substitution. Kept as a
 * fetched JSON (vs imported) so basemap tweaks don't need a rebuild.
 *
 * next.config.ts still references NEXT_PUBLIC_R2_PUBLIC_URL for
 * images.remotePatterns (photo rendering), so that env var stays
 * meaningful even though this loader no longer consumes it.
 */
export async function loadToirepoStyle(): Promise<StyleSpecification> {
  const res = await fetch('/map-style/toirepo-paper.json')
  if (!res.ok) {
    throw new Error(`Failed to load map style: ${res.status} ${res.statusText}`)
  }
  return (await res.json()) as StyleSpecification
}
