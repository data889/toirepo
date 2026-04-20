// moderateToilet(toiletId) — Haiku 4.5 multimodal review of one submission.
//
// M6 P2: persists the parsed result into the ToiletModeration table via
// upsert (one row per Toilet, re-running overwrites). Pipeline callers
// (submission.create) read the returned decision + confidence to apply
// the hybrid auto-reject policy; the rawText + usage are retained for
// audit / cost tracking.

import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getAnthropicClient, MODERATION_MODEL } from './client'
import {
  MODERATION_SYSTEM_PROMPT,
  parseModerationResponse,
  type ModerationResult,
} from './moderation-prompt'
import { db } from '@/server/db'
import { bucketName, getS3 } from '@/server/r2/client'

// Haiku 4.5 accepts up to 20 images per turn; 4 matches the M5 Prompt 2
// upload cap and keeps token usage predictable.
const MAX_PHOTOS_PER_CALL = 4

// All M5 P2 uploads are WebP (see lib/upload/image-processing.ts).
// The Photo row has no contentType column, so hardcode until that changes.
const PHOTO_MEDIA_TYPE = 'image/webp' as const

export interface ModerationOutput {
  moderationId: string
  result: ModerationResult
  usage: {
    inputTokens: number
    outputTokens: number
  }
  model: string
  rawText: string
}

/**
 * Run AI moderation against one toilet submission.
 *
 * Loads the toilet + up to {@link MAX_PHOTOS_PER_CALL} photos, pulls the
 * original (non-thumbnail) bytes from R2, ships them to Haiku 4.5 with
 * the moderation system prompt, and returns the parsed decision.
 *
 * Throws if the toilet doesn't exist, if any photo can't be fetched from
 * R2, or if the model returns something that doesn't match the strict
 * JSON schema.
 */
export async function moderateToilet(toiletId: string): Promise<ModerationOutput> {
  const toilet = await db.toilet.findUnique({
    where: { id: toiletId },
    include: { photos: { orderBy: { createdAt: 'asc' }, take: MAX_PHOTOS_PER_CALL } },
  })
  if (!toilet) throw new Error(`Toilet ${toiletId} not found`)

  // Pull the full-size variants (Photo.url = R2 key for original) for
  // better model accuracy. Thumbnails at 400px are too low-res to
  // reliably distinguish a urinal from a sink.
  const s3 = getS3()
  const bucket = bucketName('photos')

  const imageBlocks = await Promise.all(
    toilet.photos.map(async (photo) => {
      const cmd = new GetObjectCommand({ Bucket: bucket, Key: photo.url })
      const response = await s3.send(cmd)
      const bytes = await response.Body?.transformToByteArray()
      if (!bytes) throw new Error(`Failed to fetch photo body for key=${photo.url}`)
      return {
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: PHOTO_MEDIA_TYPE,
          data: Buffer.from(bytes).toString('base64'),
        },
      }
    }),
  )

  const description = [
    `Type: ${toilet.type}`,
    `Name (multi-locale JSON): ${JSON.stringify(toilet.name)}`,
    `Address (multi-locale JSON): ${JSON.stringify(toilet.address)}`,
    `Access note (multi-locale JSON): ${toilet.accessNote ? JSON.stringify(toilet.accessNote) : '(none)'}`,
    `Coordinates: ${toilet.latitude.toFixed(5)}, ${toilet.longitude.toFixed(5)}`,
    `Photo count: ${toilet.photos.length}`,
    '',
    'Analyze the images and text fields, then output the strict JSON moderation result.',
  ].join('\n')

  const anthropic = getAnthropicClient()
  const response = await anthropic.messages.create({
    model: MODERATION_MODEL,
    max_tokens: 512,
    system: MODERATION_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [...imageBlocks, { type: 'text', text: description }],
      },
    ],
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Moderation response contained no text block')
  }

  const result = parseModerationResponse(textBlock.text)
  const rawText = textBlock.text
  const inputTokens = response.usage.input_tokens
  const outputTokens = response.usage.output_tokens

  // Upsert into ToiletModeration — 1:1 with Toilet (toiletId @unique).
  // Re-runs overwrite; callers who want history should move to a 1:N
  // model (out of scope for M6 P2).
  const record = await db.toiletModeration.upsert({
    where: { toiletId },
    update: {
      decision: result.decision,
      confidence: result.confidence,
      reasons: result.reasons,
      issues: result.issues,
      model: response.model,
      inputTokens,
      outputTokens,
      rawText,
    },
    create: {
      toiletId,
      decision: result.decision,
      confidence: result.confidence,
      reasons: result.reasons,
      issues: result.issues,
      model: response.model,
      inputTokens,
      outputTokens,
      rawText,
    },
  })

  return {
    moderationId: record.id,
    result,
    usage: { inputTokens, outputTokens },
    model: response.model,
    rawText,
  }
}
