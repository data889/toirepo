// Server-only by directory convention (src/server/). See redis.ts header
// comment for why no 'server-only' import marker.
import { Ratelimit } from '@upstash/ratelimit'
import { redis } from './redis'

// SPEC §6.3 — rate-limit classes. Naming: {domain}:{operation}[:{window}].
// Windows are Upstash's Duration literals: `${number} ${'s'|'m'|'h'|'d'}`.
//
// M7 P1 renamed review:submit → review:create, confirmation:submit →
// confirmation:toggle (matches new toggle semantics), and added
// appeal:create. Old names had no call-sites; the rename is safe at
// the Redis layer (no orphan counters to migrate).
const CONFIGS = {
  'toilet:submit:hourly': { requests: 5, window: '1 h' as const },
  'toilet:submit:daily': { requests: 20, window: '1 d' as const },
  'photo:upload': { requests: 20, window: '1 h' as const },
  'review:create': { requests: 5, window: '1 h' as const },
  'confirmation:toggle': { requests: 20, window: '1 h' as const },
  'appeal:create': { requests: 3, window: '1 d' as const },
  // photo:view buckets the public presigned-GET endpoint by IP. Anonymous
  // visitors need to see photos to judge a toilet's signal quality, so the
  // procedure is publicProcedure — the IP cap is the only line of defense
  // against bots scraping presigned URLs.
  'photo:view': { requests: 60, window: '1 m' as const },
  'auth:signin': { requests: 5, window: '15 m' as const },
  // dispute:submit reserved for future OwnerDispute wiring (business
  // owners — distinct flow from user Appeals).
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
