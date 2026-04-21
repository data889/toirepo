// Next.js runtime instrumentation entry point. Called once per
// process startup by the framework; Sentry uses it to load the
// right init file for the runtime (Node.js vs Edge).
//
// This file's existence (at repo root OR src/) is what Sentry's
// next.js SDK looks for to wire up server-side capture.

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

// Next 15+ exports a dedicated error-request hook. Sentry's SDK
// re-exports it under the framework's expected name. Forwarding so
// request errors in RSCs/server components land in Sentry with the
// correct transaction context.
export { captureRequestError as onRequestError } from '@sentry/nextjs'
