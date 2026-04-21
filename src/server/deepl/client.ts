// DeepL translation client. Server-only — uses the Free-tier API
// (api-free.deepl.com) by default; when DEEPL_API_KEY ends with
// ':fx' the SDK auto-routes there. Paid keys use the default host.
//
// Rate limit: DeepL Free is 500k chars/month + ~10 req/sec burst cap.
// We implement a client-side throttle of 10/sec so batch jobs can't
// trip the burst limit. For longer sessions the per-month char quota
// is the real ceiling — the batch script tracks + reports usage.

import * as deepl from 'deepl-node'

let cached: deepl.Translator | null = null

export function getDeepL(): deepl.Translator {
  if (cached) return cached
  const key = process.env.DEEPL_API_KEY
  if (!key) {
    throw new Error('DEEPL_API_KEY is not set — add it to .env.local before running translation.')
  }
  cached = new deepl.Translator(key, { maxRetries: 2 })
  return cached
}

// Tokens-per-second limiter — 10/s is the DeepL Free burst guideline.
// Implemented as a rolling queue so we don't need an external dep.
class RateLimiter {
  private readonly rate: number
  private readonly window: number
  private queue: number[] = []

  constructor(requestsPerSecond: number) {
    this.rate = requestsPerSecond
    this.window = 1000
  }

  async wait(): Promise<void> {
    const now = Date.now()
    this.queue = this.queue.filter((t) => now - t < this.window)
    if (this.queue.length >= this.rate) {
      const oldest = this.queue[0]
      const delay = this.window - (now - oldest) + 10
      await new Promise((r) => setTimeout(r, delay))
    }
    this.queue.push(Date.now())
  }
}

export const deeplLimiter = new RateLimiter(10)

// Supported target locales. DeepL SDK uses lowercase BCP-47 style
// codes for targets (zh-Hans / ja / en-US) after v1.26. Sources are
// similar but don't carry a region (ja / en only).
export const DEEPL_TARGETS: Record<ToirepoLocale, deepl.TargetLanguageCode> = {
  'zh-CN': 'zh-HANS',
  ja: 'ja',
  en: 'en-US',
}

export type ToirepoLocale = 'zh-CN' | 'ja' | 'en'

const DEEPL_SOURCES: Record<ToirepoLocale, deepl.SourceLanguageCode> = {
  'zh-CN': 'zh',
  ja: 'ja',
  en: 'en',
}

export async function translate(
  text: string,
  target: ToirepoLocale,
  sourceLocale?: ToirepoLocale,
): Promise<string> {
  await deeplLimiter.wait()
  const translator = getDeepL()
  // Explicit source-lang when we know the origin (e.g. OSM name:ja
  // tag); otherwise let DeepL auto-detect.
  const result = await translator.translateText(
    text,
    sourceLocale ? DEEPL_SOURCES[sourceLocale] : null,
    DEEPL_TARGETS[target],
  )
  return Array.isArray(result) ? result[0].text : result.text
}
