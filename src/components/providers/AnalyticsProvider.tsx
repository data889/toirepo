'use client'

import { useEffect } from 'react'
import { useSession } from '@/hooks/useSession'
import { initPostHog, identifyUser, resetUser } from '@/lib/analytics/posthog'

// Mounts PostHog client + ties identify/reset to the auth state.
// Renders nothing — pure side-effect component sitting in the layout.
//
// initPostHog is idempotent (guards against double init) so re-mount
// in any nested boundary is safe.

export function AnalyticsProvider() {
  const session = useSession()

  useEffect(() => {
    initPostHog()
  }, [])

  useEffect(() => {
    if (session.status === 'authenticated' && session.user?.id) {
      identifyUser(session.user.id, { trustLevel: session.user.trustLevel })
    } else if (session.status === 'unauthenticated') {
      resetUser()
    }
  }, [session.status, session.user?.id, session.user?.trustLevel])

  return null
}
