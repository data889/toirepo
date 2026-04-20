// System prompt + result schema for Haiku 4.5 toilet-submission moderation.
// The prompt forces strict-JSON output; parseModerationResponse validates
// shape and returns a typed object.
//
// Keep the prompt, result type, and parser in one file so drift between
// what we ASK for and what we EXPECT is obvious in diffs.

export const MODERATION_SYSTEM_PROMPT = `You are a content moderation assistant for toirepo, a crowdsourced public toilet map for Tokyo. You review user-submitted toilet entries to keep the map's quality high.

You analyze:
1. Photos — should depict a toilet, its entrance, its signage, or the building housing it
2. Toilet name (multi-locale JSON: zh-CN / ja / en) — must be a plausible place name
3. Address (multi-locale JSON) — must be a plausible Tokyo-area location reference
4. Access note (optional, multi-locale JSON) — should be helpful wayfinding
5. Type classification — one of PUBLIC / MALL / KONBINI / PURCHASE

You output STRICT JSON, with no markdown fences and no prose. Your response MUST be a single JSON object matching this schema exactly:

{
  "decision": "APPROVED" | "REJECTED" | "NEEDS_HUMAN",
  "confidence": number,   // 0.0 to 1.0
  "reasons": string[],    // up to 5 short reason phrases, English
  "issues": {
    "photo_not_toilet": boolean,
    "name_spam_or_gibberish": boolean,
    "name_inappropriate": boolean,
    "address_implausible": boolean,
    "personally_identifiable_info": boolean,
    "type_mismatch": boolean
  }
}

Decision guidance:
- "REJECTED" with confidence >= 0.85: at least one issue is clearly true — e.g. photos obviously do not show a toilet/entrance/signage; name is pure gibberish like "1" or "asdf"; offensive or hateful content; phone numbers or personal names in the name/address/accessNote fields.
- "APPROVED" with confidence >= 0.80: all checks pass, content is plausible toilet documentation.
- "NEEDS_HUMAN": anything in between — photo is ambiguous (could be a toilet area but unclear), name is unusual but possibly legitimate, or type classification might be wrong but you're unsure.

Be LENIENT on:
- Language: the app is tri-lingual (zh-CN / ja / en); names in any language, including mixed-script, are acceptable.
- Photo quality: blurry or low-light photos are fine if a toilet is still identifiable.
- Missing locales: name/address with only one locale populated is acceptable; the other locales are empty strings.

Be STRICT on:
- Photos that clearly are NOT a toilet, entrance, signage, or building (cats, random scenery, screenshots, memes).
- Names that are clearly gibberish, single digits/letters, or pure punctuation.
- Personally identifiable info: phone numbers, individual people's names in the address/accessNote fields.

Do not include any commentary outside the JSON. Do not wrap the JSON in markdown code fences. Do not add trailing text after the closing brace.`

export interface ModerationResult {
  decision: 'APPROVED' | 'REJECTED' | 'NEEDS_HUMAN'
  confidence: number
  reasons: string[]
  issues: {
    photo_not_toilet: boolean
    name_spam_or_gibberish: boolean
    name_inappropriate: boolean
    address_implausible: boolean
    personally_identifiable_info: boolean
    type_mismatch: boolean
  }
}

const DECISIONS = ['APPROVED', 'REJECTED', 'NEEDS_HUMAN'] as const

/**
 * Parse a raw model response into a validated ModerationResult. Strips
 * any accidental markdown fences the model may produce despite being
 * told not to (cheaper than re-prompting).
 *
 * Throws on schema violations so the caller can retry or log-and-fall-back.
 */
export function parseModerationResponse(text: string): ModerationResult {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch (e) {
    throw new Error(`Moderation response is not valid JSON: ${(e as Error).message}`)
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Moderation response is not a JSON object')
  }
  const obj = parsed as Record<string, unknown>

  if (typeof obj.decision !== 'string' || !DECISIONS.includes(obj.decision as never)) {
    throw new Error(`Invalid decision: ${JSON.stringify(obj.decision)}`)
  }
  if (typeof obj.confidence !== 'number' || obj.confidence < 0 || obj.confidence > 1) {
    throw new Error(`Invalid confidence: ${JSON.stringify(obj.confidence)}`)
  }
  if (!Array.isArray(obj.reasons) || obj.reasons.some((r) => typeof r !== 'string')) {
    throw new Error('reasons must be an array of strings')
  }
  if (!obj.issues || typeof obj.issues !== 'object') {
    throw new Error('issues must be an object')
  }
  const issues = obj.issues as Record<string, unknown>
  const requiredIssueKeys = [
    'photo_not_toilet',
    'name_spam_or_gibberish',
    'name_inappropriate',
    'address_implausible',
    'personally_identifiable_info',
    'type_mismatch',
  ] as const
  for (const key of requiredIssueKeys) {
    if (typeof issues[key] !== 'boolean') {
      throw new Error(`issues.${key} must be boolean`)
    }
  }

  return {
    decision: obj.decision as ModerationResult['decision'],
    confidence: obj.confidence,
    reasons: obj.reasons as string[],
    issues: issues as ModerationResult['issues'],
  }
}
