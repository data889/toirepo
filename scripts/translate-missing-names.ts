// Batch backfill of Toilet.name / Toilet.address locale coverage
// using DeepL. Targets OSM-imported rows that carry a ja (or zh-CN)
// value but are missing one or both of the other two locales.
//
// Two modes:
//   pnpm deepl:translate --dry-run     → fetch source, compute
//     translations in memory, print a sample, DO NOT write.
//   pnpm deepl:translate --execute     → same + write back to DB.
//
// Defaults to dry-run when no flag is passed (safety first).
//
// Output goes to logs/deepl-YYYYMMDD.json so a retry can pick up
// after interruption. Failed rows land in logs/deepl-failed-*.json
// with {id, reason} for hand review.
//
// Usage:
//   DATABASE_URL='...' pnpm deepl:translate --dry-run
//   DATABASE_URL='...' pnpm deepl:translate --execute

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { announceTarget } from './lib/env-boot'
import { db } from '@/server/db'
import { translate, type ToirepoLocale } from '@/server/deepl/client'
import { applyBrandOverrides, formatEnglishAddress, hasKana } from '@/server/deepl/brand-overrides'

// Translation strategy per cell (M8 brand-overrides extension):
//   1. Run brand-overrides against the ja source. Known brand names,
//      station names, and facility nouns substitute in place.
//   2. Skip DeepL only when BOTH hold:
//        - target is zh-CN (kanji reads natively in Chinese) AND
//        - no hiragana/katakana remains
//      en target always needs DeepL even for kana-free kanji strings
//      because kanji don't romanize without a transliteration pass
//      ("東京都" has to become "Tokyo", not stay as kanji).
//   3. Otherwise send the ORIGINAL ja text to DeepL (mixing
//      partially-replaced input confuses the engine) and re-apply
//      overrides on the DeepL result to correct mistranslated brand
//      names (劳森 → 罗森, Seven-Eleven → 7-Eleven).
//   4. For en address output, formatEnglishAddress inserts the dashes
//      DeepL drops ("25 20" → "25-20").
async function translateCell(
  source: string,
  target: ToirepoLocale,
  sourceLocale: ToirepoLocale,
  kind: 'name' | 'address',
): Promise<{ text: string; usedDeepL: boolean }> {
  const overridden = applyBrandOverrides(source, target)
  const finishAddress = (s: string) =>
    kind === 'address' && target === 'en' ? formatEnglishAddress(s) : s

  if (target === 'zh-CN' && !hasKana(overridden)) {
    return { text: finishAddress(overridden), usedDeepL: false }
  }
  const deeplOut = await translate(source, target, sourceLocale)
  const corrected = applyBrandOverrides(deeplOut, target)
  return { text: finishAddress(corrected), usedDeepL: true }
}

type LocalizedValue = Record<string, string>

interface TranslationWork {
  toiletId: string
  slug: string
  currentName: LocalizedValue | null
  currentAddress: LocalizedValue | null
  // What the translation pipeline will add. Only fields currently
  // missing OR empty appear here.
  planName: Partial<Record<ToirepoLocale, string>>
  planAddress: Partial<Record<ToirepoLocale, string>>
}

function nonEmpty(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

function extractLocale(json: unknown, locale: ToirepoLocale): string | null {
  if (!json || typeof json !== 'object') return null
  const obj = json as LocalizedValue
  return nonEmpty(obj[locale]) ? obj[locale] : null
}

async function findTargets(limit: number): Promise<TranslationWork[]> {
  // Toilet.name is Json? — query for any with ja or zh-CN set but
  // at least one of the others missing. Prisma doesn't have a
  // fluent JSON-null-check, so we broadly fetch + filter in JS.
  // Good enough: M11 OSM import gave us 10k rows, most are
  // complete after M8 first pass — this batch handles incremental.
  const rows = await db.toilet.findMany({
    where: {
      status: { in: ['APPROVED', 'PENDING'] },
      source: 'OSM_IMPORT',
    },
    select: {
      id: true,
      slug: true,
      name: true,
      address: true,
    },
    take: limit,
  })

  const work: TranslationWork[] = []
  for (const row of rows) {
    const n = row.name as LocalizedValue | null
    const a = row.address as LocalizedValue | null

    const existingNames: Partial<Record<ToirepoLocale, string>> = {
      'zh-CN': extractLocale(n, 'zh-CN') ?? undefined,
      ja: extractLocale(n, 'ja') ?? undefined,
      en: extractLocale(n, 'en') ?? undefined,
    }
    const existingAddresses: Partial<Record<ToirepoLocale, string>> = {
      'zh-CN': extractLocale(a, 'zh-CN') ?? undefined,
      ja: extractLocale(a, 'ja') ?? undefined,
      en: extractLocale(a, 'en') ?? undefined,
    }

    const nameSource = existingNames.ja ?? existingNames['zh-CN'] ?? existingNames.en
    const addrSource = existingAddresses.ja ?? existingAddresses['zh-CN'] ?? existingAddresses.en

    const planName: Partial<Record<ToirepoLocale, string>> = {}
    const planAddress: Partial<Record<ToirepoLocale, string>> = {}

    if (nameSource) {
      for (const loc of ['zh-CN', 'ja', 'en'] as ToirepoLocale[]) {
        if (!existingNames[loc]) planName[loc] = nameSource // placeholder
      }
    }
    if (addrSource) {
      for (const loc of ['zh-CN', 'ja', 'en'] as ToirepoLocale[]) {
        if (!existingAddresses[loc]) planAddress[loc] = addrSource
      }
    }

    if (Object.keys(planName).length > 0 || Object.keys(planAddress).length > 0) {
      work.push({
        toiletId: row.id,
        slug: row.slug,
        currentName: n,
        currentAddress: a,
        planName,
        planAddress,
      })
    }
  }

  return work
}

async function translateBatch(work: TranslationWork[]): Promise<{
  translated: Array<{
    toiletId: string
    slug: string
    newName: LocalizedValue
    newAddress: LocalizedValue
  }>
  failed: Array<{ toiletId: string; reason: string }>
  charsUsed: number
}> {
  const translated: Array<{
    toiletId: string
    slug: string
    newName: LocalizedValue
    newAddress: LocalizedValue
  }> = []
  const failed: Array<{ toiletId: string; reason: string }> = []
  let charsUsed = 0

  for (const item of work) {
    try {
      const newName: LocalizedValue = { ...((item.currentName as LocalizedValue) ?? {}) }
      const newAddress: LocalizedValue = { ...((item.currentAddress as LocalizedValue) ?? {}) }

      for (const [loc, sourceText] of Object.entries(item.planName)) {
        if (!sourceText) continue
        const srcLocale = (
          (item.currentName as LocalizedValue)?.ja
            ? 'ja'
            : (item.currentName as LocalizedValue)?.['zh-CN']
              ? 'zh-CN'
              : 'en'
        ) as ToirepoLocale
        const { text, usedDeepL } = await translateCell(
          sourceText,
          loc as ToirepoLocale,
          srcLocale,
          'name',
        )
        newName[loc] = text
        if (usedDeepL) charsUsed += sourceText.length
      }

      for (const [loc, sourceText] of Object.entries(item.planAddress)) {
        if (!sourceText) continue
        const srcLocale = (
          (item.currentAddress as LocalizedValue)?.ja
            ? 'ja'
            : (item.currentAddress as LocalizedValue)?.['zh-CN']
              ? 'zh-CN'
              : 'en'
        ) as ToirepoLocale
        const { text, usedDeepL } = await translateCell(
          sourceText,
          loc as ToirepoLocale,
          srcLocale,
          'address',
        )
        newAddress[loc] = text
        if (usedDeepL) charsUsed += sourceText.length
      }

      translated.push({ toiletId: item.toiletId, slug: item.slug, newName, newAddress })
    } catch (e) {
      failed.push({ toiletId: item.toiletId, reason: e instanceof Error ? e.message : String(e) })
    }
  }

  return { translated, failed, charsUsed }
}

async function main() {
  const args = process.argv.slice(2)
  const execute = args.includes('--execute')
  const sampleOnly = args.includes('--sample')
  const limit = Number(args.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? 50)

  await announceTarget({ graceSeconds: execute ? 5 : 0 })
  console.log(`🔍 Scanning toilets (limit=${limit})…`)
  const work = await findTargets(limit)
  console.log(`   Found ${work.length} rows with missing locale coverage.`)

  if (work.length === 0) {
    console.log('✓ Nothing to translate. Exiting.')
    return
  }

  const runSize = sampleOnly ? Math.min(10, work.length) : work.length
  const toRun = work.slice(0, runSize)
  console.log(`→ Translating ${runSize} rows via DeepL…`)

  const { translated, failed, charsUsed } = await translateBatch(toRun)

  console.log(`\n✓ Translated ${translated.length}, failed ${failed.length}.`)
  console.log(`   Chars billed by DeepL: ~${charsUsed}`)

  // Sample print — first 10 rows either way, for visual inspection.
  console.log('\n--- Sample (first 10) ---')
  for (const t of translated.slice(0, 10)) {
    console.log(`\n  [${t.slug}]`)
    console.log(`    name:`)
    for (const [loc, v] of Object.entries(t.newName)) {
      console.log(`      ${loc}: ${v}`)
    }
    console.log(`    address:`)
    for (const [loc, v] of Object.entries(t.newAddress)) {
      console.log(`      ${loc}: ${v}`)
    }
  }

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  mkdirSync('logs', { recursive: true })
  writeFileSync(
    join('logs', `deepl-${date}-${execute ? 'execute' : 'dryrun'}.json`),
    JSON.stringify({ translated, failed, charsUsed }, null, 2),
  )
  console.log(`\n📝 Wrote logs/deepl-${date}-${execute ? 'execute' : 'dryrun'}.json`)

  if (!execute) {
    console.log('\n🚫 Dry-run mode. Database NOT updated.')
    console.log('   Rerun with --execute once the sample reads correctly.')
    return
  }

  console.log('\n📝 Writing back to database…')
  let written = 0
  for (const t of translated) {
    try {
      await db.toilet.update({
        where: { id: t.toiletId },
        data: { name: t.newName, address: t.newAddress },
      })
      written++
    } catch (e) {
      failed.push({ toiletId: t.toiletId, reason: `write: ${e instanceof Error ? e.message : e}` })
    }
  }
  console.log(`✓ Wrote ${written} rows.`)
  if (failed.length > 0) {
    writeFileSync(join('logs', `deepl-${date}-failed.json`), JSON.stringify(failed, null, 2))
    console.log(`⚠ ${failed.length} failures logged to logs/deepl-${date}-failed.json`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('✗ Script failed:', e)
    process.exit(1)
  })
