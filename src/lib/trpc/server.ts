import 'server-only'
import { cache } from 'react'
import { headers } from 'next/headers'
import { createCaller } from '@/server/api/root'
import { createTRPCContext } from '@/server/trpc-context'

// React cache() dedupes per-request so multiple RSCs in the same render
// share one context (one auth() call, one header snapshot).
const createContext = cache(async () => {
  const h = await headers()
  return createTRPCContext({ headers: h })
})

// Lazy factory: top-level `await createContext()` would force this module
// into a Promise shape that trips esbuild/tsx in some configs. The
// callsite pattern `const api = await getApi()` in a Server Component
// is one extra line but keeps module evaluation synchronous.
export const getApi = async () => createCaller(await createContext())
