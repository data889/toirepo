// Shared env-loading shim for prod-capable scripts.
//
// Why this exists: package.json used to invoke these scripts via
// `tsx --env-file=.env.local ...`. That flag silently OVERRODE an
// externally exported DATABASE_URL, so `export DATABASE_URL='<prod
// URI>' && pnpm osm:import-global` actually wrote the local docker
// URL back over the prod one, making every M8 DeepL translation and
// M12 global OSM import land in local docker instead of Supabase.
// Prod had been stuck at M10 P1's 10,107 rows while local ballooned
// to 365,759 — the env trap hid this for weeks.
//
// The fix flips precedence: external env wins, .env.local is the
// fallback. Import this module BEFORE any module that reads
// DATABASE_URL (notably `../../src/server/db`), since Prisma's
// PrismaClient is constructed at import time and latches onto
// whatever process.env.DATABASE_URL holds when the adapter is built.
//
// Usage in a script:
//
//   import { announceTarget } from './lib/env-boot'
//   import { db } from '../src/server/db'
//   // ↑ env-boot runs first by virtue of declaration order
//
//   async function main() {
//     await announceTarget({ graceSeconds: 5 })
//     // ... rest of script
//   }

import { config as dotenvConfig } from 'dotenv'

// Top-level side effect: conditionally load .env.local. Must run
// synchronously at module evaluation so the PrismaClient adapter
// construction downstream sees the right DATABASE_URL.
if (!process.env.DATABASE_URL) {
  dotenvConfig({ path: '.env.local' })
}

export interface TargetInfo {
  url: string
  host: string
  isProd: boolean
}

export async function announceTarget(opts: { graceSeconds?: number } = {}): Promise<TargetInfo> {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('✗ DATABASE_URL is required (set in .env.local or export before running)')
    process.exit(1)
  }

  let host: string
  try {
    host = new URL(url).host
  } catch {
    console.error(`✗ DATABASE_URL is not a valid URL: ${url.slice(0, 40)}…`)
    process.exit(1)
  }

  const isProd = !host.includes('localhost') && !host.includes('127.0.0.1')
  console.log(`🎯 Target: ${isProd ? 'PROD' : 'LOCAL'} — ${host}`)

  const grace = opts.graceSeconds ?? 0
  if (isProd && grace > 0) {
    console.log(`⏰ ${grace}s grace period to cancel with Ctrl+C…`)
    await new Promise((r) => setTimeout(r, grace * 1000))
  }

  return { url, host, isProd }
}
