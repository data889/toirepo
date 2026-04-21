'use client'

import { useSession as useNextAuthSession } from 'next-auth/react'
import type { Session } from 'next-auth'

// Wraps next-auth's useSession to expose a stable, typed surface for
// the M7 P2.2 write-path components. Returns a discriminated union so
// consumers can branch on `status` without re-checking nullability of
// session.user inside each render path.
//
// status:
//  - 'loading'       — session fetch in flight (initial mount before
//                      cookie round-trip resolves)
//  - 'unauthenticated' — no session; UI should show signin CTA
//  - 'authenticated'   — `user` is populated with id/role/trustLevel
//
// Note: trustLevel comes from the session callback in src/server/auth.ts
// (M7 P1) so callers do not need a per-render DB lookup.

export type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'unauthenticated'; user: null }
  | { status: 'authenticated'; user: Session['user'] }

export function useSession(): AuthState {
  const { data, status } = useNextAuthSession()
  if (status === 'loading') return { status: 'loading', user: null }
  if (status === 'unauthenticated' || !data?.user) {
    return { status: 'unauthenticated', user: null }
  }
  return { status: 'authenticated', user: data.user }
}
