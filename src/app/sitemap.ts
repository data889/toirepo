import type { MetadataRoute } from 'next'
import { db } from '@/server/db'
import { routing } from '@/i18n/routing'
import { getSiteUrl } from '@/lib/site-url'

// Static surfaces (root + per-locale roots) + dynamic toilet detail
// pages. Per-locale URLs are emitted explicitly so search engines
// crawl Chinese / Japanese / English variants. Hreflang annotations
// live in the page-level metadata (alternates.languages); sitemap is
// just enumeration.
//
// Cap: sitemap protocol allows 50k URLs / file. With ~10k toilets
// × 3 locales = 30k entries. Within the cap. If toilet count
// crosses 16k we need to split into multiple sitemaps via the
// generateSitemaps() route convention; not yet needed for MVP.

export const revalidate = 3600 // 1h — toilet additions don't need < 1h SEO freshness

const PUBLIC_VISIBLE = ['APPROVED', 'CLOSED', 'NO_TOILET_HERE'] as const

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = getSiteUrl()
  const now = new Date()

  // Static entries (one per locale of every static page)
  const staticPaths = ['', '/about', '/privacy', '/terms']
  const staticEntries: MetadataRoute.Sitemap = staticPaths.flatMap((path) =>
    routing.locales.map((locale) => ({
      url: `${site}/${locale}${path}`,
      lastModified: now,
      changeFrequency: path === '' ? ('daily' as const) : ('monthly' as const),
      priority: path === '' ? 1.0 : 0.5,
    })),
  )

  // Dynamic toilet detail pages. Pull once and emit one URL per locale.
  // Selecting only the slug + updatedAt keeps memory low even at
  // 10k+ rows (~1MB total).
  let toiletEntries: MetadataRoute.Sitemap = []
  try {
    const toilets = await db.toilet.findMany({
      where: { status: { in: [...PUBLIC_VISIBLE] } },
      select: { slug: true, updatedAt: true },
      take: 16000,
    })
    toiletEntries = toilets.flatMap((t) =>
      routing.locales.map((locale) => ({
        url: `${site}/${locale}/t/${t.slug}`,
        lastModified: t.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })),
    )
  } catch (err) {
    // Build-time DB connection may fail if env vars are missing on
    // first deploy. Returning just the static entries keeps the
    // sitemap.xml endpoint serving rather than 500ing — search engines
    // will pick up toilet URLs on the next regenerate cycle.
    console.error('[sitemap] toilet query failed, falling back to static entries:', err)
  }

  return [...staticEntries, ...toiletEntries]
}
