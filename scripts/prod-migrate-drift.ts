// Detects schema drift between local prisma/schema.prisma and the prod
// DB (DIRECT_URL). Read-only — never writes to the DB.
//
// Why this exists: M2 / M6 P2 / M7 P1 / M7 P1.5 each saw Prisma 7
// auto-generate migration SQL that conflicted with the actual prod
// schema (DROP NOT NULL, DROP INDEX on PostGIS columns). Running this
// before `prod:migrate` lets the operator catch any preexisting drift
// instead of letting `migrate deploy` fail mid-pipeline.
//
// Output:
//   - 'no schema drift detected' → safe to run prod:migrate
//   - any other output → stop, read the SQL diff, decide whether to
//     hand-patch prod or update local schema
//
// Usage:
//   DIRECT_URL='postgresql://...?sslmode=require' pnpm prod:migrate-drift

import { execSync } from 'node:child_process'

function main() {
  const url = process.env.DIRECT_URL
  if (!url) {
    console.error('✗ DIRECT_URL is required.')
    process.exit(1)
  }

  if (/localhost|127\.0\.0\.1/.test(url)) {
    console.error('✗ DIRECT_URL points at localhost. Drift checks are for prod only.')
    process.exit(1)
  }

  console.log('🔍 Checking schema drift between local schema and', new URL(url).host)
  console.log('   (read-only — no DB writes)\n')

  // `prisma migrate diff` prints the SQL to migrate FROM prod TO local
  // schema. Empty output = no drift.
  let output: string
  try {
    output = execSync(
      [
        'pnpm prisma migrate diff',
        `--from-url='${url}'`,
        '--to-schema-datamodel=prisma/schema.prisma',
        '--script',
      ].join(' '),
      { encoding: 'utf-8' },
    )
  } catch (err) {
    console.error('✗ Drift check failed:', err)
    process.exit(1)
  }

  // Prisma prints the no-op marker as "-- This is an empty migration."
  const trimmed = output.trim()
  const noChanges =
    trimmed === '' ||
    trimmed.includes('This is an empty migration') ||
    trimmed.startsWith('-- This is empty')

  if (noChanges) {
    console.log('✓ No schema drift detected — prod schema matches prisma/schema.prisma')
    process.exit(0)
  }

  console.log('⚠ Drift detected. SQL that would migrate prod TO local schema:\n')
  console.log(output)
  console.log('\n  → If this is a fresh prod DB, this output is the FULL initial schema.')
  console.log('    That is expected. Proceed with `pnpm prod:migrate`.')
  console.log('  → If prod already has data, READ THE SQL CAREFULLY before applying.')
  console.log('    See KNOWN_ISSUES.md "Prisma 7 drift" sections for past patterns.')
}

main()
