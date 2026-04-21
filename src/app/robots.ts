import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/site-url'

// Allow indexing of public marketing surfaces. Disallow:
//   - /admin/* (moderation queue, admin-only)
//   - /me/* (per-user pages, no public value, behind auth)
//   - /api/* (tRPC + auth callbacks; no human-readable content)
//   - /auth/* (signin/signup pages — keep out of search)
//
// /sitemap.xml link helps crawlers find toilet detail pages even when
// no other page links to them.

export default function robots(): MetadataRoute.Robots {
  const site = getSiteUrl()
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/me/', '/api/', '/auth/'],
      },
    ],
    sitemap: `${site}/sitemap.xml`,
    host: site,
  }
}
