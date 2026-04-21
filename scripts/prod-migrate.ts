// Production Prisma migration runner. Executes `prisma migrate deploy`
// against the URL in DIRECT_URL (NOT DATABASE_URL — pooler URIs reject
// migration commands). Safety guards:
//   - refuses to run if DIRECT_URL points at localhost (use prisma migrate dev)
//   - refuses to run if DIRECT_URL is missing
//   - lists applied migrations + tables after success so the operator
//     can eyeball
//
// Usage:
//   DIRECT_URL='postgresql://...?sslmode=require' pnpm prod:migrate
//
// Does NOT seed. Does NOT touch existing data. M11 OSM import is a
// separate command run after this succeeds.

import { execSync } from 'node:child_process'
import { Client } from 'pg'

async function main() {
  const url = process.env.DIRECT_URL
  if (!url) {
    console.error('✗ DIRECT_URL is required (Supabase Direct connection URI, port 5432).')
    process.exit(1)
  }

  if (/localhost|127\.0\.0\.1/.test(url)) {
    console.error('✗ DIRECT_URL points at localhost. Use `pnpm prisma migrate dev` for local DB.')
    console.error('  This script is for prod (Supabase) only.')
    process.exit(1)
  }

  console.log('🔐 Target host:', new URL(url).host)
  console.log(
    '   (sslmode in URL?)',
    url.includes('sslmode=') ? 'yes' : 'NO — add ?sslmode=require',
  )

  console.log('\n📦 Running prisma migrate deploy...')
  try {
    // Pass DIRECT_URL through as the env Prisma reads (prisma.config.ts
    // resolves DIRECT_URL ?? DATABASE_URL).
    execSync('pnpm prisma migrate deploy', {
      stdio: 'inherit',
      env: { ...process.env, DIRECT_URL: url },
    })
  } catch {
    console.error('✗ Migration failed. See Prisma output above.')
    process.exit(1)
  }

  console.log('\n📋 Verifying schema...')
  const client = new Client({ connectionString: url })
  await client.connect()

  try {
    const tables = await client.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `)
    console.log(`   ${tables.rows.length} tables:`)
    for (const row of tables.rows) console.log(`   - ${row.tablename}`)

    const postgis = await client.query('SELECT PostGIS_Version() as v')
    console.log(`   PostGIS: ${postgis.rows[0].v}`)

    const applied = await client.query(`
      SELECT migration_name, finished_at
      FROM "_prisma_migrations"
      ORDER BY finished_at DESC
      LIMIT 5
    `)
    console.log(`   Last ${applied.rows.length} applied migrations:`)
    for (const row of applied.rows) {
      console.log(`   - ${row.migration_name} (${row.finished_at?.toISOString() ?? 'pending'})`)
    }
  } finally {
    await client.end()
  }

  console.log('\n✓ Production migration complete.')
}

main().catch((err) => {
  console.error('✗ Unexpected error:', err)
  process.exit(1)
})
