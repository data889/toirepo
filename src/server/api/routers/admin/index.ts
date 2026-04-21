import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import type { Prisma } from '@/generated/prisma'
import { createTRPCRouter, adminProcedure } from '../../trpc'
import { recalculateTrustLevel } from '@/server/trust/autoUpgrade'

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

    // Pull the old status + submitter first so we can attribute the
    // counter change correctly on a transition (and skip on a no-op).
    const before = await ctx.db.toilet.findUnique({
      where: { id: input.toiletId },
      select: { status: true, submittedById: true },
    })
    if (!before) {
      throw new Error(`Toilet ${input.toiletId} not found`)
    }

    const toilet = await ctx.db.toilet.update({
      where: { id: input.toiletId },
      data: {
        status: newStatus,
        // Stamp publishedAt on first approval so the public map can later
        // show "published N days ago" and so AuditLog inference is easy.
        ...(newStatus === 'APPROVED' ? { publishedAt: new Date() } : {}),
      },
    })

    // M7 P1: counter bookkeeping + trust recalc.
    // Only credit the submitter if (a) there is one (OSM imports don't
    // have submittedById) and (b) the status actually changed from the
    // previous value — repeated approves on the same row don't double-count.
    if (before.submittedById && before.status !== newStatus) {
      const counterField = newStatus === 'APPROVED' ? 'approvedSubmissions' : 'rejectedSubmissions'
      await ctx.db.user.update({
        where: { id: before.submittedById },
        data: {
          [counterField]: { increment: 1 },
          autoTrustChecked: false,
        },
      })
      await recalculateTrustLevel(before.submittedById)
    }

    return { id: toilet.id, status: toilet.status }
  }),

  // ==========================================================
  // M7 P2.3 · Review admin queue
  // ==========================================================

  /**
   * List PENDING reviews for the admin queue. Filter by Haiku verdict
   * so admins can triage AI-flagged content first.
   */
  listPendingReviews: adminProcedure
    .input(
      z.object({
        filter: z
          .enum(['ALL', 'AI_APPROVED', 'AI_FLAG', 'AI_REJECT', 'NO_MODERATION'])
          .default('ALL'),
        limit: z.number().int().min(1).max(50).default(20),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where: Prisma.ReviewWhereInput = { status: 'PENDING' }
      if (input.filter === 'AI_APPROVED') where.aiDecision = 'APPROVED'
      else if (input.filter === 'AI_FLAG') where.aiDecision = 'NEEDS_HUMAN'
      else if (input.filter === 'AI_REJECT') where.aiDecision = 'REJECTED'
      else if (input.filter === 'NO_MODERATION') where.aiDecision = null

      const rows = await ctx.db.review.findMany({
        where,
        select: {
          id: true,
          rating: true,
          body: true,
          photoKeys: true,
          status: true,
          aiDecision: true,
          aiConfidence: true,
          aiReasons: true,
          createdAt: true,
          user: { select: { id: true, email: true, name: true, trustLevel: true } },
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
        orderBy: { createdAt: 'asc' },
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
   * Admin decision on a Review:
   *  - APPROVED → publishes to the public review list
   *  - REJECTED → hides + counts toward the user's rejectedSubmissions
   *               counter (note: counter rename is intentional — Reviews
   *               and toilet submissions share the same trust signal in
   *               MVP per the SPEC §14 approval-rate logic). Trust
   *               recalculated.
   *  - HIDDEN   → admin-hidden without the trust counter penalty (use
   *               for borderline-but-not-malicious content)
   *
   * `note` is accepted but not yet persisted on the Review row — Review
   * has no rejectionNote column today (schema unchanged per CLAUDE.md).
   * AuditLog wiring will pick it up in a later iteration; the input
   * shape is there now so the UI can submit without churn later.
   */
  resolveReview: adminProcedure
    .input(
      z.object({
        reviewId: z.string().min(1),
        decision: z.enum(['APPROVED', 'REJECTED', 'HIDDEN']),
        note: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const before = await ctx.db.review.findUnique({
        where: { id: input.reviewId },
        select: { status: true, userId: true },
      })
      if (!before) throw new TRPCError({ code: 'NOT_FOUND' })

      const updated = await ctx.db.review.update({
        where: { id: input.reviewId },
        data: { status: input.decision },
      })

      // Trust recalc only when this is a fresh transition AND the
      // decision affects the rejection-rate signal. APPROVED + REJECTED
      // both update the counters; HIDDEN intentionally does not.
      if (before.status !== input.decision && input.decision !== 'HIDDEN') {
        const counterField =
          input.decision === 'APPROVED' ? 'approvedSubmissions' : 'rejectedSubmissions'
        await ctx.db.user.update({
          where: { id: before.userId },
          data: { [counterField]: { increment: 1 }, autoTrustChecked: false },
        })
        await recalculateTrustLevel(before.userId)
      }

      return { id: updated.id, status: updated.status }
    }),

  // ==========================================================
  // M7 P1.5 · Appeal admin queue
  // ==========================================================

  listAppeals: adminProcedure
    .input(
      z.object({
        type: z
          .enum([
            'OWN_SUBMISSION_REJECT',
            'REPORT_DATA_ERROR',
            'SUGGEST_EDIT',
            'REPORT_CLOSED',
            'REPORT_NO_TOILET',
            'SELF_SOFT_DELETE',
          ])
          .optional(),
        status: z.enum(['PENDING', 'UPHELD', 'DISMISSED']).default('PENDING'),
        limit: z.number().int().min(1).max(50).default(20),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where: Prisma.AppealWhereInput = { status: input.status }
      if (input.type) where.type = input.type
      const rows = await ctx.db.appeal.findMany({
        where,
        select: {
          id: true,
          type: true,
          reason: true,
          evidence: true,
          proposedChanges: true,
          status: true,
          aiDecision: true,
          aiConfidence: true,
          aiReasons: true,
          createdAt: true,
          user: { select: { id: true, email: true, name: true, trustLevel: true } },
          targetToilet: {
            select: {
              id: true,
              slug: true,
              status: true,
              name: true,
              address: true,
              type: true,
              floor: true,
              latitude: true,
              longitude: true,
              osmId: true,
              submittedById: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        skip: input.cursor ? 1 : 0,
      })
      let nextCursor: string | undefined
      if (rows.length > input.limit) {
        const next = rows.pop()
        nextCursor = next?.id
      }
      return { appeals: rows, nextCursor }
    }),

  /**
   * Admin decision on any Appeal. UPHELD side effects by type:
   *   OWN_SUBMISSION_REJECT → Toilet REJECTED → APPROVED (+ publishedAt)
   *   REPORT_DATA_ERROR     → Toilet APPROVED → REJECTED
   *   SUGGEST_EDIT          → Toilet fields patched from proposedChanges
   *                           + lastCommunityEditAt/By recorded. If the
   *                           target is an OSM row and originalOsmTags
   *                           is null, snapshot the current tags first.
   *   REPORT_CLOSED         → Toilet APPROVED → CLOSED (stays visible)
   *   REPORT_NO_TOILET      → Toilet APPROVED → NO_TOILET_HERE (stays visible)
   *   SELF_SOFT_DELETE      → Toilet → REJECTED (hard hide; row kept)
   *
   * DISMISSED: no target mutation, only the Appeal row updates.
   */
  resolveAppeal: adminProcedure
    .input(
      z.object({
        appealId: z.string().min(1),
        decision: z.enum(['UPHELD', 'DISMISSED']),
        note: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const appeal = await ctx.db.appeal.findUnique({
        where: { id: input.appealId },
        select: {
          id: true,
          type: true,
          status: true,
          targetToiletId: true,
          userId: true,
          proposedChanges: true,
        },
      })
      if (!appeal) throw new TRPCError({ code: 'NOT_FOUND' })
      if (appeal.status !== 'PENDING') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'appeal.alreadyResolved' })
      }

      await ctx.db.$transaction(async (tx) => {
        await tx.appeal.update({
          where: { id: appeal.id },
          data: {
            status: input.decision,
            resolutionNote: input.note ?? null,
            resolvedById: ctx.user.id,
            resolvedAt: new Date(),
          },
        })

        if (input.decision !== 'UPHELD' || !appeal.targetToiletId) return

        switch (appeal.type) {
          case 'OWN_SUBMISSION_REJECT': {
            await tx.toilet.update({
              where: { id: appeal.targetToiletId },
              data: { status: 'APPROVED', publishedAt: new Date() },
            })
            break
          }
          case 'REPORT_DATA_ERROR':
          case 'SELF_SOFT_DELETE': {
            await tx.toilet.update({
              where: { id: appeal.targetToiletId },
              data: { status: 'REJECTED' },
            })
            break
          }
          case 'REPORT_CLOSED': {
            await tx.toilet.update({
              where: { id: appeal.targetToiletId },
              data: { status: 'CLOSED' },
            })
            break
          }
          case 'REPORT_NO_TOILET': {
            await tx.toilet.update({
              where: { id: appeal.targetToiletId },
              data: { status: 'NO_TOILET_HERE' },
            })
            break
          }
          case 'SUGGEST_EDIT': {
            const pc = appeal.proposedChanges as Record<string, unknown> | null
            if (!pc) break

            // Snapshot upstream OSM tags on the first community edit —
            // lets future rollback or OSM feedback keep provenance.
            const current = await tx.toilet.findUnique({
              where: { id: appeal.targetToiletId },
              select: {
                osmId: true,
                originalOsmTags: true,
                name: true,
                address: true,
                type: true,
                floor: true,
              },
            })

            const patch: Prisma.ToiletUpdateInput = {
              lastCommunityEditAt: new Date(),
              lastCommunityEditByUser: { connect: { id: appeal.userId } },
            }

            if (current?.osmId && current.originalOsmTags === null) {
              patch.originalOsmTags = {
                name: current.name,
                address: current.address,
                type: current.type,
                floor: current.floor,
              } as unknown as Prisma.InputJsonValue
            }

            if (typeof pc.name === 'string') {
              const currentName = (current?.name as Record<string, string> | null) ?? {}
              patch.name = { ...currentName, en: pc.name } as unknown as Prisma.InputJsonValue
            }
            if (typeof pc.address === 'string') {
              const currentAddress = (current?.address as Record<string, string> | null) ?? {}
              patch.address = {
                ...currentAddress,
                en: pc.address,
              } as unknown as Prisma.InputJsonValue
            }
            if (typeof pc.type === 'string') {
              patch.type = pc.type as 'PUBLIC' | 'MALL' | 'KONBINI' | 'PURCHASE'
            }
            if (typeof pc.floor === 'string') patch.floor = pc.floor
            // M7 P1.5 hotfix: hours field removed entirely from
            // ProposedChangesSchema. When Toilet gains an hours column
            // (M8+), reintroduce both the zod field and a patch line
            // here. See M8+ TODO in KNOWN_ISSUES.md.

            await tx.toilet.update({
              where: { id: appeal.targetToiletId },
              data: patch,
            })
            break
          }
        }
      })

      return { id: appeal.id, status: input.decision }
    }),
})
