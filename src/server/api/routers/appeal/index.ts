import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { createTRPCRouter, protectedProcedure, adminProcedure, withUserRateLimit } from '../../trpc'
import { canAppeal } from '@/lib/permissions'

// Appeals (M7 P1).
//   OWN_SUBMISSION_REJECT — my submission got rejected, please reconsider.
//   BAD_APPROVED_DATA     — this approved entry is wrong, please remove.
// Both types target a Toilet row (REJECTED rows still live in Toilet).
// Admin resolution (UPHELD) has a side effect: status flip on the
// target toilet.

const CreateInputSchema = z.object({
  type: z.enum(['OWN_SUBMISSION_REJECT', 'BAD_APPROVED_DATA']),
  targetToiletId: z.string().min(1),
  reason: z.string().min(20).max(2000),
  evidence: z.array(z.string().min(1).max(300)).max(4).default([]),
})

const ResolveInputSchema = z.object({
  appealId: z.string().min(1),
  decision: z.enum(['UPHELD', 'DISMISSED']),
  note: z.string().max(2000).optional(),
})

const ListPendingInputSchema = z.object({
  limit: z.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
})

export const appealRouter = createTRPCRouter({
  create: withUserRateLimit('appeal:create')
    .input(CreateInputSchema)
    .mutation(async ({ ctx, input }) => {
      const perm = canAppeal(ctx.user)
      if (!perm.ok) {
        throw new TRPCError({ code: 'FORBIDDEN', message: perm.reason })
      }

      // Target must exist; OWN_SUBMISSION_REJECT additionally requires the
      // submitter to be the caller (you can't appeal someone else's reject).
      const target = await ctx.db.toilet.findUnique({
        where: { id: input.targetToiletId },
        select: { id: true, status: true, submittedById: true },
      })
      if (!target) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'appeal.targetNotFound' })
      }

      if (input.type === 'OWN_SUBMISSION_REJECT') {
        if (target.submittedById !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'appeal.notYourSubmission' })
        }
        if (target.status !== 'REJECTED') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'appeal.targetNotRejected' })
        }
      } else {
        // BAD_APPROVED_DATA
        if (target.status !== 'APPROVED') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'appeal.targetNotApproved' })
        }
      }

      // One pending appeal per (user, target) at a time.
      const existingPending = await ctx.db.appeal.count({
        where: {
          userId: ctx.user.id,
          targetToiletId: input.targetToiletId,
          status: 'PENDING',
        },
      })
      if (existingPending > 0) {
        throw new TRPCError({ code: 'CONFLICT', message: 'appeal.duplicatePending' })
      }

      const appeal = await ctx.db.appeal.create({
        data: {
          userId: ctx.user.id,
          type: input.type,
          targetToiletId: input.targetToiletId,
          reason: input.reason,
          evidence: input.evidence,
          status: 'PENDING',
        },
      })

      // Placeholder admin notification; M7 P3 replaces with real channel.
      console.log(`[appeal] ${input.type} #${appeal.id} by ${ctx.user.id} → admin queue`)

      return { id: appeal.id, status: appeal.status }
    }),

  listMine: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.appeal.findMany({
      where: { userId: ctx.user.id },
      select: {
        id: true,
        type: true,
        targetToiletId: true,
        reason: true,
        evidence: true,
        status: true,
        resolutionNote: true,
        resolvedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
  }),

  listPending: adminProcedure.input(ListPendingInputSchema).query(async ({ ctx, input }) => {
    const rows = await ctx.db.appeal.findMany({
      where: { status: 'PENDING' },
      select: {
        id: true,
        type: true,
        reason: true,
        evidence: true,
        createdAt: true,
        user: { select: { id: true, email: true, name: true, trustLevel: true } },
        targetToilet: {
          select: {
            id: true,
            slug: true,
            status: true,
            name: true,
            address: true,
            latitude: true,
            longitude: true,
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
   * Admin decision. Side effects:
   *   UPHELD + OWN_SUBMISSION_REJECT → Toilet.status REJECTED → APPROVED
   *   UPHELD + BAD_APPROVED_DATA    → Toilet.status APPROVED → REJECTED
   *   DISMISSED → no target state change
   */
  resolve: adminProcedure.input(ResolveInputSchema).mutation(async ({ ctx, input }) => {
    const appeal = await ctx.db.appeal.findUnique({
      where: { id: input.appealId },
      select: {
        id: true,
        type: true,
        status: true,
        targetToiletId: true,
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

      if (input.decision === 'UPHELD' && appeal.targetToiletId) {
        const targetStatus: 'APPROVED' | 'REJECTED' =
          appeal.type === 'OWN_SUBMISSION_REJECT' ? 'APPROVED' : 'REJECTED'
        await tx.toilet.update({
          where: { id: appeal.targetToiletId },
          data: {
            status: targetStatus,
            ...(targetStatus === 'APPROVED' ? { publishedAt: new Date() } : {}),
          },
        })
      }
    })

    return { id: appeal.id, status: input.decision }
  }),
})
