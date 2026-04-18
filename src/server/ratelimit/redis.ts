// Server-only by directory convention (src/server/). No `'server-only'`
// import marker here because tsx-run scripts (scripts/smoke-test-*.ts)
// transitively import this module and Node's resolver trips on
// 'server-only' outside a Next.js runtime. Client components reaching
// into src/server/ratelimit/ would anyway trip 'server-only' on a
// downstream tRPC module, so the defense is not lost.
import { Redis } from '@upstash/redis'

function createRedisClient() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set')
  }

  return new Redis({ url, token })
}

const globalForRedis = globalThis as unknown as {
  redis: ReturnType<typeof createRedisClient> | undefined
}

export const redis = globalForRedis.redis ?? createRedisClient()

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis
