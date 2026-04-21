// Production healthcheck. Hits the canonical surfaces of the prod
// deployment and reports pass/fail per check. Designed to be the
// first thing run after Ming finishes the manual deploy steps in
// docs/DEPLOYMENT.md.
//
// Usage:
//   PROD_URL='https://toirepo.com' pnpm prod:healthcheck

interface Check {
  name: string
  url: string
  expect: 'ok' | 'json' | 'redirect'
  jsonContains?: string[]
}

async function run() {
  const base = process.env.PROD_URL?.replace(/\/$/, '')
  if (!base) {
    console.error('✗ PROD_URL is required (e.g. https://toirepo.com)')
    process.exit(1)
  }

  console.log(`🏥 Healthcheck against ${base}\n`)

  const checks: Check[] = [
    { name: 'root redirect → default locale', url: `${base}/`, expect: 'redirect' },
    { name: 'zh-CN home', url: `${base}/zh-CN`, expect: 'ok' },
    { name: 'ja home', url: `${base}/ja`, expect: 'ok' },
    { name: 'en home', url: `${base}/en`, expect: 'ok' },
    { name: 'manifest.webmanifest', url: `${base}/manifest.webmanifest`, expect: 'json' },
    { name: 'sitemap.xml', url: `${base}/sitemap.xml`, expect: 'ok' },
    { name: 'robots.txt', url: `${base}/robots.txt`, expect: 'ok' },
    {
      name: 'tRPC toilet.list (HTTP-batch endpoint reachable)',
      url: `${base}/api/trpc/toilet.list?batch=1&input=${encodeURIComponent(
        JSON.stringify({ '0': { json: { limit: 1 } } }),
      )}`,
      expect: 'json',
    },
    {
      name: 'OAuth signin route (Google redirect)',
      url: `${base}/api/auth/signin/google`,
      expect: 'redirect',
    },
  ]

  let pass = 0
  let fail = 0

  for (const check of checks) {
    process.stdout.write(`  [${check.name}] `)
    try {
      const res = await fetch(check.url, {
        redirect: 'manual',
        headers: { 'User-Agent': 'toirepo-healthcheck/1.0' },
      })
      const status = res.status

      if (check.expect === 'redirect') {
        // 3xx with Location header is success
        if (status >= 300 && status < 400 && res.headers.get('location')) {
          console.log(`✓ ${status} → ${res.headers.get('location')?.slice(0, 60)}`)
          pass++
        } else {
          console.log(`✗ expected 3xx + Location, got ${status}`)
          fail++
        }
      } else if (check.expect === 'json') {
        if (status === 200) {
          const text = await res.text()
          let valid = true
          try {
            JSON.parse(text)
          } catch {
            valid = false
          }
          if (!valid) {
            console.log(`✗ 200 but body is not JSON`)
            fail++
          } else {
            console.log(`✓ 200 + valid JSON (${text.length}b)`)
            pass++
          }
        } else {
          console.log(`✗ expected 200, got ${status}`)
          fail++
        }
      } else {
        // expect: 'ok'
        if (status === 200) {
          console.log(`✓ 200`)
          pass++
        } else {
          console.log(`✗ expected 200, got ${status}`)
          fail++
        }
      }
    } catch (err) {
      console.log(`✗ network error: ${err instanceof Error ? err.message : err}`)
      fail++
    }
  }

  console.log(`\n${pass}/${pass + fail} checks passed.`)
  if (fail > 0) {
    console.log('\nNext steps if any check failed:')
    console.log('  - 4xx on home pages → check Vercel deployment logs')
    console.log('  - 5xx on home pages → check Vercel runtime logs (most likely env var missing)')
    console.log('  - tRPC fail → DATABASE_URL likely wrong or PostGIS extension missing')
    console.log('  - OAuth fail → AUTH_GOOGLE_ID / AUTH_URL missing or callback URL not authorized')
    console.log('  - manifest/sitemap/robots fail → build artifact missing, redeploy')
    process.exit(1)
  }
  console.log('\n✓ Production looks healthy.')
}

run().catch((err) => {
  console.error('✗ Unexpected error:', err)
  process.exit(1)
})
