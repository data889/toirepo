// Centralized Anthropic SDK client. Mirrors the r2/client.ts pattern:
// no 'server-only' marker so tsx-run scripts (scripts/test-moderation.ts)
// can import transitively. Call sites are gated via the src/server/
// directory convention instead.

import Anthropic from '@anthropic-ai/sdk'

let _client: Anthropic | null = null

export function getAnthropicClient(): Anthropic {
  if (_client) return _client
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set — add it to .env.local')
  }
  _client = new Anthropic({ apiKey })
  return _client
}

// Pinned model for all moderation calls. Haiku 4.5 chosen for multimodal
// support + low cost per-call at M5-era submission volumes. Bump the
// constant (and re-verify prompt compliance) when switching models.
export const MODERATION_MODEL = 'claude-haiku-4-5' as const
