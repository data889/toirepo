// Sentry client-side config. Loaded by instrumentation.ts's
// register() on 'nodejs'/'edge' — but for the BROWSER runtime this
// file is imported directly by Sentry's webpack plugin.
//
// Key tradeoffs:
//   - tracesSampleRate 0.1 prod — 10% of sessions get traces, enough
//     to see real p50/p95 without burning budget.
//   - replaysSessionSampleRate 0 — we're not recording every session
//     (free tier gives limited replay minutes).
//   - replaysOnErrorSampleRate 1.0 — 100% replay capture on actual
//     errors, which is where the value lives.
//
// beforeSend filters out the noisy "Failed to fetch" / "NetworkError"
// / "Load failed" strings. These are overwhelmingly user-side
// network glitches (train tunnel, captive portal) — Sentry has no
// actionable signal to give us, and they'd drown out real bugs.

import * as Sentry from '@sentry/nextjs'

const NOISY_ERROR_PATTERNS = [
  /Failed to fetch/i,
  /NetworkError/i,
  /Load failed/i,
  /The operation was aborted/i, // AbortController cleanup on unmount
]

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  // Keep breadcrumbs rich but capped so giant payloads don't get
  // stuffed into every report.
  maxBreadcrumbs: 40,
  integrations: [
    // Replay only mounts when an error is captured + OnError sample
    // rate kicks in. Zero passive overhead otherwise.
    Sentry.replayIntegration({ maskAllText: false, blockAllMedia: true }),
  ],
  beforeSend(event) {
    const msg = event.message ?? event.exception?.values?.[0]?.value ?? ''
    if (NOISY_ERROR_PATTERNS.some((p) => p.test(msg))) {
      return null
    }
    return event
  },
})
