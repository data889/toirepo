'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { httpBatchStreamLink, loggerLink } from '@trpc/client'
import { createTRPCReact } from '@trpc/react-query'
import superjson from 'superjson'
import type { AppRouter } from '@/server/api/root'

export const api = createTRPCReact<AppRouter>()

function getBaseUrl() {
  if (typeof window !== 'undefined') return ''
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return `http://localhost:${process.env.PORT ?? 3000}`
}

// tRPC error codes whose appearance is part of normal product flow — auth
// gates, permission gates, missing rows, validation rejections. Surfacing
// them as console.error in dev floods the panel with red noise that hides
// real defects. Anything not on this list still goes to console.error.
const SOFT_TRPC_CODES = new Set([
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'BAD_REQUEST',
  'UNPROCESSABLE_CONTENT',
  'TOO_MANY_REQUESTS',
])

function extractTrpcCode(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null
  // Shape A: TRPCClientError thrown directly
  if ('data' in result) {
    const data = (result as { data?: unknown }).data
    if (data && typeof data === 'object' && 'code' in data) {
      const code = (data as { code?: unknown }).code
      return typeof code === 'string' ? code : null
    }
  }
  // Shape B: OperationResultEnvelope wrapping an error
  if ('error' in result) {
    return extractTrpcCode((result as { error?: unknown }).error)
  }
  return null
}

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30 * 1000 },
        },
      }),
  )

  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        loggerLink({
          enabled: () => process.env.NODE_ENV === 'development',
          logger: (opts) => {
            if (opts.direction === 'up') {
              // Outgoing requests: noisy if every keystroke triggers a query,
              // so keep them at info level (browsers hide info by default).
              console.info(`>> ${opts.type} ${opts.path} #${opts.id}`)
              return
            }
            const result = opts.result
            const isError =
              result instanceof Error ||
              (result &&
                typeof result === 'object' &&
                'result' in result &&
                result.result &&
                typeof result.result === 'object' &&
                'error' in result.result &&
                result.result.error)
            if (!isError) {
              // Successful responses are uninteresting; suppress to keep the
              // dev console scannable.
              return
            }
            const errSource =
              result instanceof Error
                ? result
                : ((result as { result?: { error?: unknown } }).result?.error ?? result)
            const code = extractTrpcCode(errSource) ?? 'UNKNOWN'
            const fn = SOFT_TRPC_CODES.has(code) ? console.warn : console.error
            const message =
              errSource && typeof errSource === 'object' && 'message' in errSource
                ? String((errSource as { message?: unknown }).message)
                : ''
            fn(`<< ${opts.type} ${opts.path} #${opts.id} [${code}]`, message)
          },
        }),
        httpBatchStreamLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
        }),
      ],
    }),
  )

  return (
    <api.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </api.Provider>
  )
}
