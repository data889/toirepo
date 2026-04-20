// CLI harness for moderateToilet(). Usage:
//   pnpm test:moderation           # defaults to slug=1 (Ming's test data)
//   pnpm test:moderation my-slug   # any existing Toilet slug
//
// Loads .env.local via tsx --env-file flag (see package.json script).
// Prints submission metadata, calls the model, dumps the parsed result
// and token usage. Exits 1 on any error (DB miss, R2 miss, parse fail).

import { db } from '../src/server/db'
import { moderateToilet } from '../src/server/anthropic/moderation'

async function main() {
  const slug = process.argv[2] ?? '1'

  const toilet = await db.toilet.findFirst({
    where: { slug },
    include: { photos: { select: { id: true, url: true, thumbnailUrl: true } } },
  })
  if (!toilet) {
    console.error(`❌ Toilet with slug='${slug}' not found.`)
    console.error(`   Available slugs:`)
    const all = await db.toilet.findMany({ select: { slug: true, status: true }, take: 20 })
    all.forEach((t) => console.error(`     - ${t.slug} (${t.status})`))
    process.exit(1)
  }

  console.log(`🤖 Moderating toilet: ${toilet.id} (slug=${slug})`)
  console.log(`📝 Type: ${toilet.type}`)
  console.log(`📝 Name:    ${JSON.stringify(toilet.name)}`)
  console.log(`📝 Address: ${JSON.stringify(toilet.address)}`)
  console.log(`📝 AccessNote: ${toilet.accessNote ? JSON.stringify(toilet.accessNote) : '(none)'}`)
  console.log(`📷 Photos (${toilet.photos.length}):`)
  toilet.photos.forEach((p) => console.log(`     - ${p.url}`))
  console.log('')

  const started = Date.now()
  const output = await moderateToilet(toilet.id)
  const elapsedMs = Date.now() - started

  console.log(`✅ Moderation complete in ${elapsedMs}ms`)
  console.log(`   Model: ${output.model}`)
  console.log(`   Tokens: ${output.usage.inputTokens} in / ${output.usage.outputTokens} out`)
  console.log('')
  console.log(`Result:`)
  console.log(JSON.stringify(output.result, null, 2))
}

main()
  .catch((e) => {
    console.error('❌ Moderation failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
