import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  // Prisma's query engine and adapter stack are Node-only and depend on
  // transitive packages (e.g. @prisma/client-runtime-utils) that pnpm stores
  // under .pnpm/. Telling Next.js to treat them as external means it
  // require()s them at runtime instead of trying to bundle, which fixes
  // the "Cannot find module" errors surfaced by the middleware and any
  // Server Component that imports src/server/db.ts.
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg', 'pg'],
}

export default withNextIntl(nextConfig)
