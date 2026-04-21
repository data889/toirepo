// Single source of truth for the canonical site URL. Used by
// sitemap.ts, robots.ts, and the layout metadataBase. Falls back to
// localhost in dev so local builds still produce sensible absolute
// URLs for testing.
//
// In Vercel prod / preview, set NEXT_PUBLIC_SITE_URL to the
// canonical hostname (e.g. https://toirepo.com). Preview deployments
// can override per-deploy if you ever need preview-correct OG tags;
// MVP doesn't bother and just lets preview render with toirepo.com
// in the metadata.

export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'http://localhost:3000'
}
