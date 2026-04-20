// Toilet.name and Toilet.address are stored as Json columns shaped
//   { 'zh-CN': string, ja: string, en: string }
// per SPEC §5.2's i18n design. These helpers resolve the right value
// for the active locale and degrade gracefully when the requested
// locale is missing.

type LocaleMap = Record<string, string>

function resolveLocalized(field: unknown, locale: string): string {
  if (!field || typeof field !== 'object') return ''
  const map = field as LocaleMap

  // Exact-match first.
  if (typeof map[locale] === 'string' && map[locale].length > 0) {
    return map[locale]
  }
  // Fallback chain: prefer English (lingua franca), then Japanese
  // (basemap audience), then zh-CN (project's primary content locale),
  // then anything non-empty.
  for (const fallback of ['en', 'ja', 'zh-CN']) {
    if (typeof map[fallback] === 'string' && map[fallback].length > 0) {
      return map[fallback]
    }
  }
  const first = Object.values(map).find((v) => typeof v === 'string' && v.length > 0)
  return first ?? ''
}

export function resolveToiletName(toilet: { name: unknown }, locale: string): string {
  return resolveLocalized(toilet.name, locale)
}

export function resolveToiletAddress(toilet: { address: unknown }, locale: string): string {
  return resolveLocalized(toilet.address, locale)
}
