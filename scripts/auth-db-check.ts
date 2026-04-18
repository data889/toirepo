// Run with: pnpm auth:check
// Lists all User rows so the operator can confirm auth flows landed rows.

import { db } from '../src/server/db'

async function main() {
  const users = await db.user.findMany({
    select: { id: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  console.log(`Found ${users.length} user(s):`)
  users.forEach((u) => {
    console.log(`  ${u.email} · role=${u.role} · created=${u.createdAt.toISOString()}`)
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
