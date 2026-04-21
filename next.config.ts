import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import { withSentryConfig } from '@sentry/nextjs'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

// Optional: parse R2_PUBLIC_URL out into hostname + protocol for the
// images.remotePatterns entry. Falls back to a no-op pattern when the
// env var is unset (build still succeeds, runtime image loader will
// reject — caught by the prod healthcheck).
function r2RemotePattern() {
  const url = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL
  if (!url) return null
  try {
    const u = new URL(url)
    return {
      protocol: u.protocol.replace(':', '') as 'http' | 'https',
      hostname: u.hostname,
      pathname: '/**',
    }
  } catch {
    return null
  }
}

const r2Pattern = r2RemotePattern()

const nextConfig: NextConfig = {
  // Prisma's query engine and adapter stack are Node-only and depend on
  // transitive packages (e.g. @prisma/client-runtime-utils) that pnpm stores
  // under .pnpm/. Telling Next.js to treat them as external means it
  // require()s them at runtime instead of trying to bundle, which fixes
  // the "Cannot find module" errors surfaced by the middleware and any
  // Server Component that imports src/server/db.ts.
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg', 'pg'],

  // M10 P1: allow next/image to render R2-hosted photos. Pattern derived
  // from NEXT_PUBLIC_R2_PUBLIC_URL so dev / staging / prod all auto-adapt.
  images: r2Pattern ? { remotePatterns: [r2Pattern] } : undefined,

  // M10 P1: baseline security headers. Production-targeted; dev gets the
  // same set since none of these break HMR.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // 1 year HSTS + preload eligibility. Cloudflare Registrar will
          // also set HSTS at the edge; this is defense in depth.
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          // Allow same-origin embeds only — toirepo doesn't intentionally
          // ship in third-party iframes.
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // Stop browsers from MIME-sniffing responses we labeled wrong.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Strip Referer for cross-origin nav (don't leak our URLs to
          // OSM tile providers etc).
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Lock down browser APIs we don't use. Geolocation is the only
          // one toirepo needs (T3.4 user-location button) and stays self.
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(self), camera=(), microphone=(), payment=()',
          },
        ],
      },
    ]
  },
}

// M10 P2 · Sentry wrapper. Order matters: Sentry goes on the OUTSIDE
// so it sees the final next-intl-wrapped config (source maps upload
// needs to know the real build output paths). Build-only auth token
// + org/project slugs come from env.
const configWithIntl = withNextIntl(nextConfig)

export default withSentryConfig(configWithIntl, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Silent unless there's actual source-maps work to report. Keeps
  // Vercel build log from drowning in Sentry plugin chatter.
  silent: true,
  // Widen source-map coverage to include client-side chunks — default
  // skips public assets but our map-interaction bundle lives there.
  widenClientFileUpload: true,
  // Don't bundle the runtime Sentry logger into the production
  // client bundle — saves ~2KB and silences console.* noise.
  disableLogger: true,
  // Skip source-map upload entirely when the auth token is missing
  // (local dev, PR without Sentry env). Runtime SDK still injects;
  // events just won't have symbolicated stack traces for those
  // builds, which is fine for CI / preview.
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
})
