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
  REVIEW_MODERATION_SYSTEM_PROMPT,
  buildAppealSystemPrompt,
  parseModerationResponse,
  parseReviewModerationResponse,
  parseAppealModerationResponse,
  type ModerationResult,
  type ReviewModerationResult,
  type AppealModerationResult,
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

// ============================================================
// M7 P1 · Review moderation
// ============================================================

export interface ReviewModerationOutput {
  result: ReviewModerationResult
  usage: { inputTokens: number; outputTokens: number }
  model: string
  rawText: string
}

/**
 * Moderate one Review via Haiku 4.5 (text + optional photos).
 *
 * Unlike moderateToilet, this function does NOT write to a dedicated
 * moderation table — Review has inlined moderation columns per M7 P1
 * schema decision. The caller (review.create / admin tooling) reads the
 * result and updates Review.status + Review.aiDecision/aiConfidence/
 * aiReasons/aiRawText/aiModeratedAt directly.
 *
 * Throws on DB miss, R2 miss, or schema parse failure.
 */
export async function moderateReview(reviewId: string): Promise<ReviewModerationOutput> {
  const review = await db.review.findUnique({
    where: { id: reviewId },
    select: { id: true, rating: true, body: true, photoKeys: true },
  })
  if (!review) throw new Error(`Review ${reviewId} not found`)

  // Photos are R2 keys. Reviews cap at MAX_PHOTOS_PER_CALL too; anything
  // beyond gets dropped silently for cost/latency.
  const s3 = getS3()
  const bucket = bucketName('photos')
  const photoKeys = review.photoKeys.slice(0, MAX_PHOTOS_PER_CALL)

  const imageBlocks = await Promise.all(
    photoKeys.map(async (key) => {
      const cmd = new GetObjectCommand({ Bucket: bucket, Key: key })
      const response = await s3.send(cmd)
      const bytes = await response.Body?.transformToByteArray()
      if (!bytes) throw new Error(`Failed to fetch review photo body for key=${key}`)
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
    `Rating: ${review.rating} / 5`,
    `Body: ${review.body ? JSON.stringify(review.body) : '(empty)'}`,
    `Photo count: ${photoKeys.length}`,
    '',
    'Evaluate this review for moderation and output strict JSON.',
  ].join('\n')

  const anthropic = getAnthropicClient()
  const response = await anthropic.messages.create({
    model: MODERATION_MODEL,
    max_tokens: 512,
    system: REVIEW_MODERATION_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [...imageBlocks, { type: 'text', text: description }],
      },
    ],
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Review moderation response contained no text block')
  }

  const result = parseReviewModerationResponse(textBlock.text)
  return {
    result,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
    model: response.model,
    rawText: textBlock.text,
  }
}

// ============================================================
// M7 P1.5 · Appeal moderation (text + optional evidence photos)
// ============================================================

export interface AppealModerationOutput {
  result: AppealModerationResult
  usage: { inputTokens: number; outputTokens: number }
  model: string
  rawText: string
}

/**
 * Pre-screen one Appeal via Haiku 4.5. Advisory only — result is
 * written to Appeal.aiDecision for admin reference; nothing changes
 * Appeal.status automatically.
 */
export async function moderateAppeal(appealId: string): Promise<AppealModerationOutput> {
  const appeal = await db.appeal.findUnique({
    where: { id: appealId },
    select: {
      id: true,
      type: true,
      reason: true,
      evidence: true,
      proposedChanges: true,
      targetToilet: {
        select: { name: true, address: true, type: true, floor: true, status: true },
      },
    },
  })
  if (!appeal) throw new Error(`Appeal ${appealId} not found`)

  const s3 = getS3()
  const bucket = bucketName('photos')
  const evidenceKeys = appeal.evidence.slice(0, MAX_PHOTOS_PER_CALL)
  const imageBlocks = await Promise.all(
    evidenceKeys.map(async (key) => {
      const cmd = new GetObjectCommand({ Bucket: bucket, Key: key })
      const response = await s3.send(cmd)
      const bytes = await response.Body?.transformToByteArray()
      if (!bytes) throw new Error(`Failed to fetch evidence for key=${key}`)
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
    `AppealType: ${appeal.type}`,
    `Reason: ${JSON.stringify(appeal.reason)}`,
    `ProposedChanges: ${appeal.proposedChanges ? JSON.stringify(appeal.proposedChanges) : '(none)'}`,
    `TargetToilet snapshot: ${JSON.stringify(appeal.targetToilet ?? '(missing)')}`,
    `Evidence photos: ${evidenceKeys.length}`,
    '',
    'Pre-screen this appeal and output the strict JSON advisory result.',
  ].join('\n')

  const anthropic = getAnthropicClient()
  const response = await anthropic.messages.create({
    model: MODERATION_MODEL,
    max_tokens: 512,
    system: buildAppealSystemPrompt(appeal.type),
    messages: [
      {
        role: 'user',
        content: [...imageBlocks, { type: 'text', text: description }],
      },
    ],
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Appeal moderation response contained no text block')
  }

  const result = parseAppealModerationResponse(textBlock.text)
  return {
    result,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
    model: response.model,
    rawText: textBlock.text,
  }
}
