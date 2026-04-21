import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
  withUserRateLimit,
} from '../../trpc'
import { canReviewToilet } from '@/lib/permissions'
import { moderateReview } from '@/server/anthropic/moderation'
import { applyModerationPolicy } from '@/server/anthropic/moderation-policy'

const CreateInputSchema = z.object({
  toiletId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  body: z.string().max(2000).optional(),
  photoKeys: z.array(z.string().min(1).max(300)).max(4).default([]),
})

const ListByToiletInputSchema = z.object({
  toiletId: z.string().min(1),
  limit: z.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
})

export const reviewRouter = createTRPCRouter({
  /**
   * Upsert the caller's review for one toilet. L1+ only. Body runs
   * through Haiku moderation synchronously — high-confidence REJECT
   * lands the row as REJECTED, otherwise PENDING for admin review.
   */
  create: withUserRateLimit('review:create')
    .input(CreateInputSchema)
    .mutation(async ({ ctx, input }) => {
      const perm = await canReviewToilet(ctx.user, input.toiletId, ctx.db)
      if (!perm.ok) {
        throw new TRPCError({ code: 'FORBIDDEN', message: perm.reason })
      }

      // Upsert: same (toiletId, userId) pair updates existing row + resets
      // to PENDING so the AI re-moderates the new content.
      const review = await ctx.db.review.upsert({
        where: {
          toiletId_userId: {
            toiletId: input.toiletId,
            userId: ctx.user.id,
          },
        },
        create: {
          toiletId: input.toiletId,
          userId: ctx.user.id,
          rating: input.rating,
          body: input.body ?? null,
          photoKeys: input.photoKeys,
          status: 'PENDING',
        },
        update: {
          rating: input.rating,
          body: input.body ?? null,
          photoKeys: input.photoKeys,
          status: 'PENDING',
          aiDecision: null,
          aiConfidence: null,
          aiReasons: undefined,
          aiRawText: null,
          aiModeratedAt: null,
        },
      })

      // AI moderation: sync await, same pattern as submission.create.
      let finalStatus: 'PENDING' | 'REJECTED' = 'PENDING'
      try {
        const mod = await moderateReview(review.id)
        const outcome = applyModerationPolicy(mod.result)
        finalStatus = outcome === 'AUTO_REJECT' ? 'REJECTED' : 'PENDING'
        await ctx.db.review.update({
          where: { id: review.id },
          data: {
            status: finalStatus,
            aiDecision: mod.result.decision,
            aiConfidence: mod.result.confidence,
            aiReasons: mod.result.reasons,
            aiRawText: mod.rawText,
            aiModeratedAt: new Date(),
          },
        })
      } catch (e) {
        console.error(`[AI review moderation failed for review ${review.id}]`, e)
        // Leave as PENDING, admin queue will pick it up (M7 P3).
      }

      return { id: review.id, status: finalStatus }
    }),

  /**
   * Public read: approved reviews for one toilet, paginated. User info
   * is deliberately minimal (no email) — respects privacy while still
   * showing who wrote what.
   */
  listByToilet: publicProcedure.input(ListByToiletInputSchema).query(async ({ ctx, input }) => {
    const rows = await ctx.db.review.findMany({
      where: { toiletId: input.toiletId, status: 'APPROVED' },
      select: {
        id: true,
        rating: true,
        body: true,
        photoKeys: true,
        createdAt: true,
        user: {
          select: { id: true, name: true, image: true, trustLevel: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: input.limit + 1,
      cursor: input.cursor ? { id: input.cursor } : undefined,
      skip: input.cursor ? 1 : 0,
    })
    let nextCursor: string | undefined
    if (rows.length > input.limit) {
      const next = rows.pop()
      nextCursor = next?.id
    }
    return { reviews: rows, nextCursor }
  }),

  /**
   * Caller's own reviews including PENDING / REJECTED. Used by a
   * "My reviews" UI (M7 P2).
   *
   * M7 P2.3: includes the target toilet so the /me view can render the
   * row's title without a second round-trip per row.
   */
  listMine: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.review.findMany({
      where: { userId: ctx.user.id },
      select: {
        id: true,
        toiletId: true,
        rating: true,
        body: true,
        photoKeys: true,
        status: true,
        aiReasons: true,
        rejectionNote: true,
        createdAt: true,
        updatedAt: true,
        toilet: {
          select: {
            id: true,
            slug: true,
            name: true,
            address: true,
            type: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
  }),

  /**
   * Soft delete — flip status to HIDDEN. Only the author can delete
   * their own review (admin hide is a future admin endpoint).
   */
  delete: protectedProcedure
    .input(z.object({ reviewId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.review.findUnique({
        where: { id: input.reviewId },
        select: { userId: true },
      })
      if (!row) throw new TRPCError({ code: 'NOT_FOUND' })
      if (row.userId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'permission.notYourReview' })
      }
      await ctx.db.review.update({
        where: { id: input.reviewId },
        data: { status: 'HIDDEN' },
      })
      return { ok: true as const }
    }),
})
