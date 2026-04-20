import { z } from 'zod'
import type { Prisma } from '@/generated/prisma'
import { createTRPCRouter, adminProcedure } from '../../trpc'

// Filter selects which slice of the PENDING queue to show:
// - ALL              — all PENDING, regardless of AI state
// - AI_APPROVED      — AI said OK but MVP policy still needs human sign-off
// - AI_NEEDS_HUMAN   — AI was uncertain, explicitly flagged for human
// - NO_MODERATION   — AI call failed or predates the pipeline (edge)
const ListQueueInputSchema = z.object({
  filter: z.enum(['ALL', 'AI_APPROVED', 'AI_NEEDS_HUMAN', 'NO_MODERATION']).default('ALL'),
  sortBy: z.enum(['newest', 'oldest', 'highest_confidence', 'lowest_confidence']).default('newest'),
  limit: z.number().int().min(1).max(100).default(50),
})

const ReviewActionInputSchema = z.object({
  toiletId: z.string().min(1),
  action: z.enum(['APPROVE', 'REJECT']),
  // reviewerNote is accepted but not yet persisted — AuditLog wiring
  // belongs to a later iteration (M7 evidence-trail work).
  reviewerNote: z.string().max(500).optional(),
})

export const adminRouter = createTRPCRouter({
  /**
   * List all PENDING toilet submissions, optionally filtered by AI decision
   * state and sorted by recency or AI confidence. Admin-only.
   */
  listQueue: adminProcedure.input(ListQueueInputSchema).query(async ({ ctx, input }) => {
    const where: Prisma.ToiletWhereInput = { status: 'PENDING' }

    if (input.filter === 'AI_APPROVED') {
      where.moderation = { is: { decision: 'APPROVED' } }
    } else if (input.filter === 'AI_NEEDS_HUMAN') {
      where.moderation = { is: { decision: 'NEEDS_HUMAN' } }
    } else if (input.filter === 'NO_MODERATION') {
      where.moderation = { is: null }
    }

    let orderBy: Prisma.ToiletOrderByWithRelationInput = { createdAt: 'desc' }
    if (input.sortBy === 'oldest') orderBy = { createdAt: 'asc' }
    else if (input.sortBy === 'highest_confidence') orderBy = { moderation: { confidence: 'desc' } }
    else if (input.sortBy === 'lowest_confidence') orderBy = { moderation: { confidence: 'asc' } }

    const rows = await ctx.db.toilet.findMany({
      where,
      orderBy,
      take: input.limit,
      select: {
        id: true,
        slug: true,
        name: true,
        address: true,
        accessNote: true,
        type: true,
        status: true,
        latitude: true,
        longitude: true,
        createdAt: true,
        submittedBy: {
          select: { email: true, name: true },
        },
        photos: {
          select: {
            id: true,
            url: true,
            thumbnailUrl: true,
            width: true,
            height: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        moderation: {
          select: {
            decision: true,
            confidence: true,
            reasons: true,
            issues: true,
            createdAt: true,
          },
        },
      },
    })
    return rows
  }),

  /**
   * Flip a PENDING toilet to APPROVED (publish to the public map) or
   * REJECTED. Admin-only.
   *
   * Not idempotent on status today: calling APPROVE on an already-APPROVED
   * toilet still writes; that's acceptable since status-transition
   * bookkeeping lives in a future AuditLog row (M7).
   */
  review: adminProcedure.input(ReviewActionInputSchema).mutation(async ({ ctx, input }) => {
    const newStatus = input.action === 'APPROVE' ? 'APPROVED' : 'REJECTED'
    const toilet = await ctx.db.toilet.update({
      where: { id: input.toiletId },
      data: {
        status: newStatus,
        // Stamp publishedAt on first approval so the public map can later
        // show "published N days ago" and so AuditLog inference is easy.
        ...(newStatus === 'APPROVED' ? { publishedAt: new Date() } : {}),
      },
    })
    return { id: toilet.id, status: toilet.status }
  }),
})
