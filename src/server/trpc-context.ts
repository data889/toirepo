import { auth } from './auth'
import { db } from './db'

// Scaffold for T2.3 tRPC setup. Populating session and db here now so that
// when the tRPC initTRPC call lands, createTRPCContext already returns the
// shape procedures will expect. T2.3 will extend this with the tRPC router
// plumbing itself.

export async function createTRPCContext() {
  const session = await auth()
  return { session, db }
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>
