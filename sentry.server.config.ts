// Sentry server-side config. Runs in Node.js runtime (App Router RSC
// + Route Handlers + tRPC endpoints). Same DSN as client but the
// event shape is different — server errors have request context
// (URL, method, headers) automatically attached.

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
  maxBreadcrumbs: 40,
  // Server-side doesn't do replays.
  beforeSend(event) {
    // Prisma throws connection errors during warmup / transient DB
    // blips. P1001 / P1002 are retryable on the next request —
    // don't page on them.
    const msg = event.message ?? event.exception?.values?.[0]?.value ?? ''
    if (/P1001|P1002/.test(msg)) return null
    return event
  },
})
