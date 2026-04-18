import 'server-only'
import { TRPCError } from '@trpc/server'
import { getLimiter, type LimitKey } from './limits'

// Explicit subject tagging forces call sites to decide whether they want
// per-user or per-IP quotas — eliminates bugs like anonymous users
// sharing a single 'anonymous' userId bucket.
export type RateLimitSubject = { kind: 'user'; userId: string } | { kind: 'ip'; ip: string }

export function subjectKey(subject: RateLimitSubject): string {
  return subject.kind === 'user' ? `u:${subject.userId}` : `ip:${subject.ip}`
}

export function extractIp(headers: Headers | undefined): string {
  if (!headers) return 'unknown'
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? headers.get('x-real-ip') ?? 'unknown'
  )
}

export async function enforceLimit(key: LimitKey, subject: RateLimitSubject): Promise<void> {
  const limiter = getLimiter(key)
  const id = `${key}:${subjectKey(subject)}`
  const { success, limit, remaining, reset } = await limiter.limit(id)
  if (!success) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: `Rate limit exceeded for ${key}. Try again later.`,
      cause: { limit, remaining, reset },
    })
  }
}
