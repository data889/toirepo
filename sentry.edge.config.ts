// Sentry edge runtime config. Runs inside the Edge runtime — which
// our OG image routes + src/proxy.ts (i18n middleware) use. Smaller
// API surface than the Node runtime; Sentry's Edge integration
// handles that.

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
})
