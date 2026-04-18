import { config } from 'dotenv'
config({ path: '.env.local' })

import { db } from '../src/server/db'

type QueryRow = { id: string; lat: number; lng: number; loc: string }

async function main() {
  // Insert a minimal Toilet row to exercise enums, JSON columns, and the
  // BEFORE INSERT location trigger populating the geography column.
  const toilet = await db.toilet.create({
    data: {
      slug: 'smoke-test-' + Date.now(),
      latitude: 35.6812,
      longitude: 139.7671,
      type: 'PUBLIC',
      name: { 'zh-CN': '测试', ja: 'テスト', en: 'Test' },
      address: { 'zh-CN': '东京站', ja: '東京駅', en: 'Tokyo Station' },
      status: 'APPROVED',
    },
  })
  console.log('Created toilet:', toilet.id, toilet.slug)

  // Read back via raw SQL — the Unsupported location column is not exposed
  // on the Prisma model; we verify the trigger populated it via ST_AsText.
  const rows = await db.$queryRaw<QueryRow[]>`
    SELECT id, latitude AS lat, longitude AS lng, ST_AsText(location::geometry) AS loc
    FROM "Toilet"
    WHERE id = ${toilet.id}
  `
  console.log('Queried back:', rows[0])

  await db.toilet.delete({ where: { id: toilet.id } })
  console.log('Cleanup done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
