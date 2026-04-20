// Idempotent seed for the 20 mock Tokyo toilets.
// Uses slug as the upsert key (mock-1 .. mock-20 ids are discarded;
// the DB generates fresh cuids).
//
// Run with: pnpm seed   (which is `tsx --env-file=.env.local prisma/seed.ts`)
// No `import 'dotenv/config'` here — --env-file beats dotenv to the punch.

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma'
import { MOCK_TOILETS } from '../src/lib/map/mock-toilets'
import { slugify } from '../scripts/seed/slugify'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const db = new PrismaClient({ adapter })

async function main() {
  console.log(`🌱 Seeding ${MOCK_TOILETS.length} toilets...`)

  let created = 0
  let updated = 0

  for (const mock of MOCK_TOILETS) {
    const slug = slugify(mock.nameEn) || `toilet-${mock.id}`

    // Toilet.name and .address are Json fields per SPEC §5.2 — pack
    // all three locales as { 'zh-CN', ja, en } so future i18n display
    // (T8.x) can render the user's locale without extra columns.
    const nameJson = {
      'zh-CN': mock.name,
      ja: mock.nameJa,
      en: mock.nameEn,
    }
    // Address has no per-locale source in mock-toilets; replicate the
    // zh-CN string into all three slots until DeepL translation lands
    // in M8. The Json shape is what matters for forward-compat.
    const addressJson = {
      'zh-CN': mock.address,
      ja: mock.address,
      en: mock.address,
    }

    const data = {
      slug,
      name: nameJson,
      address: addressJson,
      type: mock.type,
      latitude: mock.lat,
      longitude: mock.lng,
      // status APPROVED bypasses the moderation queue so seed data is
      // visible immediately without going through M6's review flow.
      status: 'APPROVED' as const,
      publishedAt: new Date(),
    }

    const existing = await db.toilet.findFirst({ where: { slug } })

    if (existing) {
      await db.toilet.update({ where: { id: existing.id }, data })
      updated++
    } else {
      await db.toilet.create({ data })
      created++
    }
  }

  console.log(`✅ Seed complete: ${created} created, ${updated} updated`)
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
