// Run with: pnpm smoke:ratelimit
// Validates Upstash connectivity and sliding-window behavior.
// Uses a one-shot id per run so re-runs don't inherit each other's counters.

import { getLimiter } from '../src/server/ratelimit/limits'

async function main() {
  const limiter = getLimiter('auth:signin') // 5 req / 15 min / subject
  const id = `smoke-test:${Date.now()}`

  console.log(`Testing ratelimit 'auth:signin' (5 req / 15 min) on id=${id}`)

  for (let i = 1; i <= 7; i++) {
    const { success, remaining, reset } = await limiter.limit(id)
    const msUntilReset = reset - Date.now()
    console.log(
      `  attempt ${i}: success=${success} remaining=${remaining} resetIn=${Math.round(msUntilReset / 1000)}s`,
    )
    if (i === 5 && success) {
      console.log('  → reached quota')
    }
  }

  console.log('\n✅ Smoke test complete.')
  console.log('   Expected: first 5 success, last 2 blocked.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
