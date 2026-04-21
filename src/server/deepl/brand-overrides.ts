// Hard-coded brand / facility / station name overrides for
// Japanese → {zh-CN, en} translation. DeepL doesn't know most of
// these (it transliterates Lawson as "劳森" instead of the official
// 罗森, renders 7-Eleven as "Seven-Eleven", etc.), so we catch them
// BEFORE calling DeepL and skip the API for text that fully matches.
//
// Structure:
//   - `ja`: canonical form most commonly seen in OSM name:ja tags
//   - `aliases`: other variants (katakana spelling, Latin brand name,
//                sometimes CJK-Han form)
//   - `zh`: the authoritative Mainland-Chinese form (官方译名 > 音译)
//   - `en`: the official Latin-alphabet brand / place name
//
// Matching: at apply time we flatten every entry into {key → {zh, en}}
// pairs, sort by key length descending, and run a sequence of
// `str.replaceAll` passes. Longer keys match first so "7-Eleven
// Japan" wins over bare "Seven" etc.

export interface BrandEntry {
  ja: string
  aliases?: string[]
  zh: string
  en: string
}

export const BRAND_OVERRIDES: BrandEntry[] = [
  // ─────── Top-3 konbini (>60% of OSM convenience-store rows)
  {
    ja: 'セブン-イレブン',
    aliases: ['セブンイレブン', '7-Eleven Japan', '7-Eleven', 'Seven Eleven', 'セブン・イレブン'],
    zh: '7-Eleven',
    en: '7-Eleven',
  },
  { ja: 'ローソン', aliases: ['LAWSON', 'Lawson'], zh: '罗森', en: 'Lawson' },
  {
    ja: 'ファミリーマート',
    aliases: ['FamilyMart', 'ファミマ', 'Family Mart'],
    zh: '全家',
    en: 'FamilyMart',
  },
  // ─────── Other konbini chains
  { ja: 'ミニストップ', aliases: ['Ministop', 'MINISTOP'], zh: 'Ministop', en: 'Ministop' },
  {
    ja: 'デイリーヤマザキ',
    aliases: ['Daily Yamazaki', 'デイリー・ヤマザキ'],
    zh: 'Daily山崎',
    en: 'Daily Yamazaki',
  },
  { ja: 'ヤマザキ', aliases: ['Yamazaki'], zh: '山崎便利店', en: 'Yamazaki' },
  { ja: 'ニューデイズ', aliases: ['NewDays', 'NEWDAYS'], zh: 'NewDays', en: 'NewDays' },
  { ja: 'ポプラ', aliases: ['Poplar'], zh: 'Poplar', en: 'Poplar' },
  { ja: 'セイコーマート', aliases: ['Seicomart', 'SECOMA'], zh: 'Seicomart', en: 'Seicomart' },
  // ─────── Shopping / department stores
  { ja: 'イオン', aliases: ['AEON', 'ÆON'], zh: '永旺', en: 'AEON' },
  {
    ja: 'イトーヨーカドー',
    aliases: ['Ito-Yokado', 'イトーヨーカ堂'],
    zh: '伊藤洋华堂',
    en: 'Ito-Yokado',
  },
  { ja: '西武', aliases: ['SEIBU', 'Seibu'], zh: '西武', en: 'SEIBU' },
  { ja: '東急', aliases: ['TOKYU', 'Tokyu'], zh: '东急', en: 'TOKYU' },
  { ja: '三越', aliases: ['Mitsukoshi'], zh: '三越', en: 'Mitsukoshi' },
  { ja: '伊勢丹', aliases: ['Isetan'], zh: '伊势丹', en: 'Isetan' },
  { ja: '高島屋', aliases: ['Takashimaya', '髙島屋'], zh: '高岛屋', en: 'Takashimaya' },
  { ja: '松坂屋', aliases: ['Matsuzakaya'], zh: '松坂屋', en: 'Matsuzakaya' },
  { ja: 'マルイ', aliases: ['OIOI', '丸井', 'Marui'], zh: '丸井', en: 'OIOI' },
  {
    ja: 'ドン・キホーテ',
    aliases: ['ドンキホーテ', 'Don Quijote', 'MEGAドンキ', 'MEGA Don Quijote'],
    zh: '唐吉诃德',
    en: 'Don Quijote',
  },
  {
    ja: 'ヨドバシカメラ',
    aliases: ['Yodobashi Camera', 'Yodobashi', 'ヨドバシ'],
    zh: '友都八喜',
    en: 'Yodobashi Camera',
  },
  { ja: 'ビックカメラ', aliases: ['Bic Camera', 'BIC CAMERA'], zh: 'Bic Camera', en: 'Bic Camera' },
  // ─────── F&B chains
  {
    ja: 'スターバックス',
    aliases: ['Starbucks', 'Starbucks Coffee'],
    zh: '星巴克',
    en: 'Starbucks',
  },
  { ja: 'ドトール', aliases: ['Doutor', 'ドトールコーヒー'], zh: '罗多伦', en: 'Doutor' },
  {
    ja: 'タリーズ',
    aliases: ["Tully's", 'タリーズコーヒー', 'Tullys'],
    zh: "Tully's",
    en: "Tully's",
  },
  {
    ja: 'マクドナルド',
    aliases: ["McDonald's", 'McDonalds', 'マック'],
    zh: '麦当劳',
    en: "McDonald's",
  },
  { ja: 'モスバーガー', aliases: ['MOS Burger', 'モス'], zh: '摩斯汉堡', en: 'MOS Burger' },
  { ja: '吉野家', aliases: ['Yoshinoya'], zh: '吉野家', en: 'Yoshinoya' },
  { ja: 'すき家', aliases: ['Sukiya'], zh: '食其家', en: 'Sukiya' },
  { ja: '松屋', aliases: ['Matsuya'], zh: '松屋', en: 'Matsuya' },
  // ─────── Facility nouns (high-freq suffixes in OSM name tags)
  { ja: '公衆トイレ', aliases: ['公共トイレ'], zh: '公共厕所', en: 'Public Toilet' },
  { ja: '公園', zh: '公园', en: 'Park' },
  { ja: '神社', zh: '神社', en: 'Shrine' },
  { ja: '寺', zh: '寺', en: 'Temple' },
  { ja: '図書館', zh: '图书馆', en: 'Library' },
  { ja: '美術館', zh: '美术馆', en: 'Art Museum' },
  { ja: '博物館', zh: '博物馆', en: 'Museum' },
  { ja: '商店街', zh: '商店街', en: 'Shopping Street' },
  { ja: '駐車場', zh: '停车场', en: 'Parking' },
  // ─────── JR Yamanote line (clockwise from Tokyo)
  { ja: '東京駅', aliases: ['Tokyo Station'], zh: '东京站', en: 'Tokyo Station' },
  { ja: '有楽町駅', aliases: ['Yurakucho Station'], zh: '有乐町站', en: 'Yurakucho Station' },
  { ja: '新橋駅', aliases: ['Shimbashi Station'], zh: '新桥站', en: 'Shimbashi Station' },
  { ja: '浜松町駅', aliases: ['Hamamatsucho Station'], zh: '滨松町站', en: 'Hamamatsucho Station' },
  { ja: '田町駅', aliases: ['Tamachi Station'], zh: '田町站', en: 'Tamachi Station' },
  { ja: '品川駅', aliases: ['Shinagawa Station'], zh: '品川站', en: 'Shinagawa Station' },
  { ja: '大崎駅', aliases: ['Osaki Station'], zh: '大崎站', en: 'Osaki Station' },
  { ja: '五反田駅', aliases: ['Gotanda Station'], zh: '五反田站', en: 'Gotanda Station' },
  { ja: '目黒駅', aliases: ['Meguro Station'], zh: '目黑站', en: 'Meguro Station' },
  { ja: '恵比寿駅', aliases: ['Ebisu Station'], zh: '惠比寿站', en: 'Ebisu Station' },
  { ja: '渋谷駅', aliases: ['Shibuya Station'], zh: '涩谷站', en: 'Shibuya Station' },
  { ja: '原宿駅', aliases: ['Harajuku Station'], zh: '原宿站', en: 'Harajuku Station' },
  { ja: '代々木駅', aliases: ['Yoyogi Station'], zh: '代代木站', en: 'Yoyogi Station' },
  { ja: '新宿駅', aliases: ['Shinjuku Station'], zh: '新宿站', en: 'Shinjuku Station' },
  { ja: '新大久保駅', aliases: ['Shin-Okubo Station'], zh: '新大久保站', en: 'Shin-Okubo Station' },
  {
    ja: '高田馬場駅',
    aliases: ['Takadanobaba Station'],
    zh: '高田马场站',
    en: 'Takadanobaba Station',
  },
  { ja: '目白駅', aliases: ['Mejiro Station'], zh: '目白站', en: 'Mejiro Station' },
  { ja: '池袋駅', aliases: ['Ikebukuro Station'], zh: '池袋站', en: 'Ikebukuro Station' },
  { ja: '大塚駅', aliases: ['Otsuka Station'], zh: '大冢站', en: 'Otsuka Station' },
  { ja: '巣鴨駅', aliases: ['Sugamo Station'], zh: '巢鸭站', en: 'Sugamo Station' },
  { ja: '駒込駅', aliases: ['Komagome Station'], zh: '驹込站', en: 'Komagome Station' },
  { ja: '田端駅', aliases: ['Tabata Station'], zh: '田端站', en: 'Tabata Station' },
  {
    ja: '西日暮里駅',
    aliases: ['Nishi-Nippori Station'],
    zh: '西日暮里站',
    en: 'Nishi-Nippori Station',
  },
  { ja: '日暮里駅', aliases: ['Nippori Station'], zh: '日暮里站', en: 'Nippori Station' },
  { ja: '鶯谷駅', aliases: ['Uguisudani Station'], zh: '莺谷站', en: 'Uguisudani Station' },
  { ja: '上野駅', aliases: ['Ueno Station'], zh: '上野站', en: 'Ueno Station' },
  { ja: '御徒町駅', aliases: ['Okachimachi Station'], zh: '御徒町站', en: 'Okachimachi Station' },
  { ja: '秋葉原駅', aliases: ['Akihabara Station'], zh: '秋叶原站', en: 'Akihabara Station' },
  { ja: '神田駅', aliases: ['Kanda Station'], zh: '神田站', en: 'Kanda Station' },
  // ─────── Tokyo Metro / Toei major interchanges outside Yamanote
  { ja: '銀座駅', aliases: ['Ginza Station'], zh: '银座站', en: 'Ginza Station' },
  { ja: '六本木駅', aliases: ['Roppongi Station'], zh: '六本木站', en: 'Roppongi Station' },
  { ja: '表参道駅', aliases: ['Omotesando Station'], zh: '表参道站', en: 'Omotesando Station' },
  { ja: '日本橋駅', aliases: ['Nihombashi Station'], zh: '日本桥站', en: 'Nihombashi Station' },
  { ja: '大手町駅', aliases: ['Otemachi Station'], zh: '大手町站', en: 'Otemachi Station' },
  { ja: '霞ケ関駅', aliases: ['Kasumigaseki Station'], zh: '霞关站', en: 'Kasumigaseki Station' },
  { ja: '日比谷駅', aliases: ['Hibiya Station'], zh: '日比谷站', en: 'Hibiya Station' },
  {
    ja: '赤坂見附駅',
    aliases: ['Akasaka-mitsuke Station'],
    zh: '赤坂见附站',
    en: 'Akasaka-mitsuke Station',
  },
  { ja: '永田町駅', aliases: ['Nagatacho Station'], zh: '永田町站', en: 'Nagatacho Station' },
  {
    ja: '青山一丁目駅',
    aliases: ['Aoyama-itchome Station'],
    zh: '青山一丁目站',
    en: 'Aoyama-itchome Station',
  },
  // ─────── Final fallback: generic 駅 suffix when no compound matched above
  { ja: '駅', zh: '站', en: 'Station' },
]

interface FlatOverride {
  key: string
  zh: string
  en: string
}

/**
 * Flatten the override table into a per-key lookup sorted by key
 * length DESC. Longer keys match first so compounds like "東京駅"
 * beat the bare "駅" fallback when both would have matched.
 *
 * Memoized because both the batch script and the runtime router
 * call it repeatedly.
 */
let _flat: FlatOverride[] | null = null
export function flattenOverrides(): FlatOverride[] {
  if (_flat) return _flat
  const out: FlatOverride[] = []
  for (const entry of BRAND_OVERRIDES) {
    out.push({ key: entry.ja, zh: entry.zh, en: entry.en })
    for (const alias of entry.aliases ?? []) {
      out.push({ key: alias, zh: entry.zh, en: entry.en })
    }
  }
  out.sort((a, b) => b.key.length - a.key.length)
  _flat = out
  return out
}

/**
 * Run override replacements over `text` for the given target locale.
 * Returns the post-replaced string without touching DeepL.
 */
export function applyBrandOverrides(text: string, target: 'zh-CN' | 'ja' | 'en'): string {
  if (target === 'ja') return text // no need to translate ja → ja
  let out = text
  for (const { key, zh, en } of flattenOverrides()) {
    const replacement = target === 'zh-CN' ? zh : en
    // replaceAll is O(n·m) worst case but our override table is < 100
    // and inputs are short (name/address strings), so it's fine.
    out = out.split(key).join(replacement)
  }
  return out
}

/**
 * Heuristic: does the string still contain hiragana / katakana?
 * If so, it has material DeepL should translate. Kanji-only is
 * acceptable to pass through to zh-CN since kanji read natively
 * in Chinese (though not always with the same meaning — callers
 * decide).
 */
export function hasKana(text: string): boolean {
  return /[\u3040-\u309F\u30A0-\u30FF]/.test(text)
}

/**
 * Post-process DeepL's English address output. DeepL renders
 * Japanese address "25番20号" as "25 20" — missing the dash that
 * every international postal form expects. This regex inserts it.
 */
export function formatEnglishAddress(text: string): string {
  // Insert dash between two adjacent run-of-digits separated only by
  // whitespace. Repeat until no change so "25 20 3" → "25-20-3".
  let prev
  let cur = text
  do {
    prev = cur
    cur = cur.replace(/(\d+)\s+(\d+)/g, '$1-$2')
  } while (cur !== prev)
  return cur
}
