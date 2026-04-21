// Sentry server-side smoke test. Sends one captureException + one
// captureMessage to the project's DSN. Manual run:
//
//   pnpm tsx scripts/sentry-test.ts
//
// After running, verify in the Sentry Dashboard (Issues view) that
// two events from "[sentry-smoke]" arrived within ~30s. If they
// don't, DSN or auth token is wrong.
//
// DOES NOT run in CI. One-shot verification tool only.

import * as Sentry from '@sentry/nextjs'

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN
if (!DSN) {
  console.error('✗ NEXT_PUBLIC_SENTRY_DSN not set in env')
  process.exit(1)
}

Sentry.init({
  dsn: DSN,
  tracesSampleRate: 0,
  // Tag so we can filter these test events out of real dashboards.
  initialScope: {
    tags: { 'smoke-test': 'true' },
  },
})

async function main() {
  const stamp = new Date().toISOString()

  console.log(`→ Sending captureMessage at ${stamp}`)
  Sentry.captureMessage(`[sentry-smoke] captureMessage test at ${stamp}`)

  console.log(`→ Sending captureException at ${stamp}`)
  try {
    throw new Error(`[sentry-smoke] captureException test at ${stamp}`)
  } catch (e) {
    Sentry.captureException(e)
  }

  // Flush before exit — events are queued, otherwise process.exit
  // drops them. 2s is more than enough for two events over the
  // default Sentry transport.
  await Sentry.flush(2000)

  console.log('✓ Both events flushed to Sentry.')
  console.log(`  Open https://${process.env.SENTRY_ORG}.sentry.io/ to verify.`)
}

main().catch((e) => {
  console.error('✗ Smoke test failed:', e)
  process.exit(1)
})
