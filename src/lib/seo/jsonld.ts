// schema.org JSON-LD builders. Output goes into <script
// type="application/ld+json"> tags on the relevant pages. Keep the
// builders pure (no side effects) so they can be tested without
// rendering context.
//
// Only emit fields we actually have — schema.org discourages null
// placeholders (they become extraction noise for crawlers).

interface ToiletForSchema {
  id: string
  slug: string
  name: unknown
  address: unknown
  type: string
  latitude: number
  longitude: number
  photos?: Array<{ thumbnailUrl: string }>
}

/**
 * Per-toilet LocalBusiness. Picks PublicToilet when type=PUBLIC
 * (schema.org has a specific subtype), otherwise generic LocalBusiness.
 */
export function buildToiletLocalBusiness(args: {
  toilet: ToiletForSchema
  locale: string
  siteUrl: string
  resolvedName: string
  resolvedAddress: string
  reviewCount: number
  averageRating: number | null
}): Record<string, unknown> {
  const { toilet, locale, siteUrl, resolvedName, resolvedAddress, reviewCount, averageRating } =
    args

  const url = `${siteUrl}/${locale}/t/${toilet.slug}`

  const schemaType = toilet.type === 'PUBLIC' ? 'PublicToilet' : 'LocalBusiness'

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    '@id': url,
    name: resolvedName,
    url,
    geo: {
      '@type': 'GeoCoordinates',
      latitude: toilet.latitude,
      longitude: toilet.longitude,
    },
  }

  if (resolvedAddress) {
    schema.address = {
      '@type': 'PostalAddress',
      streetAddress: resolvedAddress,
      addressCountry: 'JP',
    }
  }

  // aggregateRating only when we have at least one APPROVED review.
  // schema.org rejects ratingCount=0 rows as invalid.
  if (reviewCount > 0 && averageRating !== null) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(averageRating.toFixed(2)),
      ratingCount: reviewCount,
      bestRating: 5,
      worstRating: 1,
    }
  }

  // Use the first photo thumbnail when available. Photo URLs are
  // presigned (1h) — we skip emitting them for now because
  // google's crawler would cache a URL that 403s in an hour.
  // Leave this out until M12 photos go on a public-CDN path.

  return schema
}

/**
 * Root WebSite schema. Declares the site name and
 * potentialAction/SearchAction — Google uses the latter to enable
 * sitelinks search box for the domain.
 */
export function buildWebSiteSchema(args: {
  siteUrl: string
  locale: string
}): Record<string, unknown> {
  const { siteUrl, locale } = args
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': siteUrl,
    url: siteUrl,
    name: 'toirepo',
    inLanguage: locale,
    // No SearchAction yet — M12 will ship a proper /search endpoint.
    // Google falls back to URL-based sitelinks without it.
  }
}
