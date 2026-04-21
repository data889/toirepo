'use client'

import posthog from 'posthog-js'

// PostHog product analytics. Browser-side only (server events would
// need posthog-node which we're not adding in M10 P1).
//
// Events stay product-flow focused: every "did something meaningful"
// moment fires a typed event. PII handling: we identify by
// session.user.id (cuid, opaque) — never email / name. The trust ladder
// + AI moderation reasons are useful funnel signals, so they ride
// along where appropriate.

let initialized = false

export function initPostHog() {
  if (typeof window === 'undefined') return
  if (initialized) return
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return // dev w/o PostHog config: silently no-op
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    capture_pageview: 'history_change', // SPA-friendly
    autocapture: false, // explicit events only — keeps the funnel clean
    person_profiles: 'identified_only',
  })
  initialized = true
}

export function identifyUser(userId: string, props?: { trustLevel?: number }) {
  if (typeof window === 'undefined' || !initialized) return
  posthog.identify(userId, props)
}

export function resetUser() {
  if (typeof window === 'undefined' || !initialized) return
  posthog.reset()
}

// ---- Typed event helpers ----

export type AnalyticsEvent =
  | { name: 'toilet_viewed'; props: { toiletId: string; type: string; status: string } }
  | { name: 'review_submitted'; props: { toiletId: string; rating: number; serverStatus: string } }
  | { name: 'confirmation_toggled'; props: { toiletId: string; confirmed: boolean } }
  | { name: 'appeal_created'; props: { toiletId: string; type: string } }
  | { name: 'photo_viewed'; props: { source: 'drawer' | 'detail' | 'gallery' } }

export function track<E extends AnalyticsEvent>(event: E['name'], props: E['props']) {
  if (typeof window === 'undefined' || !initialized) return
  posthog.capture(event, props as Record<string, unknown>)
}
