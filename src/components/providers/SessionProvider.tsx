'use client'

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react'
import type { ReactNode } from 'react'

// Client-side session boundary. M7 P2.2 introduced this so write-path
// components (ReviewForm / AppealDialog / ConfirmationCounter) can read
// trustLevel / signed-in state without prop-drilling from a Server
// Component.
//
// The existing server-side `auth()` flow in AuthStatus and tRPC context
// is unaffected — SessionProvider only powers `useSession()` in client
// components. New session HTTP fetches happen on demand from those hooks.

export function SessionProvider({ children }: { children: ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>
}
