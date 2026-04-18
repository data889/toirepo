import type { NextRequest } from 'next/server'
import { auth } from './auth'
import { db } from './db'

// tRPC context factory. Invoked by the Fetch adapter at /api/trpc route
// and by the Server caller in src/lib/trpc/server.ts. Headers are
// threaded through so future rate-limit middleware (T2.4) can read the
// caller's IP / auth cookies without re-touching globals.

export async function createTRPCContext(opts?: { headers?: Headers; req?: NextRequest }) {
  const session = await auth()
  return {
    session,
    db,
    headers: opts?.headers,
  }
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>
