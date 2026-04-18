// Server-only by directory convention (src/server/). See redis.ts header
// comment for why no 'server-only' import marker.
import { Ratelimit } from '@upstash/ratelimit'
import { redis } from './redis'

// SPEC §6.3 — 6 rate-limit classes (7 keys; toilet:submit has two windows).
// Naming: {domain}:{operation}[:{window}].
// Windows are Upstash's Duration literals: `${number} ${'s'|'m'|'h'|'d'}`.
const CONFIGS = {
  'toilet:submit:hourly': { requests: 5, window: '1 h' as const },
  'toilet:submit:daily': { requests: 20, window: '1 d' as const },
  'photo:upload': { requests: 20, window: '1 h' as const },
  'review:submit': { requests: 10, window: '1 h' as const },
  'confirmation:submit': { requests: 100, window: '1 d' as const },
  'auth:signin': { requests: 5, window: '15 m' as const },
  'dispute:submit': { requests: 3, window: '1 d' as const },
} satisfies Record<string, { requests: number; window: `${number} ${'s' | 'm' | 'h' | 'd'}` }>

export type LimitKey = keyof typeof CONFIGS

// Cache Ratelimit instances so every request reuses the same one.
const cache = new Map<LimitKey, Ratelimit>()

export function getLimiter(key: LimitKey): Ratelimit {
  let limiter = cache.get(key)
  if (!limiter) {
    const cfg = CONFIGS[key]
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(cfg.requests, cfg.window),
      analytics: true,
      prefix: `toirepo:${key}`,
    })
    cache.set(key, limiter)
  }
  return limiter
}
