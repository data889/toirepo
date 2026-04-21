import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { createTRPCRouter, protectedProcedure, withUserRateLimit } from '../../trpc'
import { canAppeal, canSoftDeleteOwnToilet } from '@/lib/permissions'
import { moderateAppeal } from '@/server/anthropic/moderation'

// M7 P1.5: appeal.create is the single entry point for every
// user-initiated change request against existing data. Admin-side
// triage + resolve moved into `admin.listAppeals` / `admin.resolveAppeal`
// so the API shape parallels M6's admin.listQueue / admin.review.

// ---- Discriminated-union input ---------------------------------

const ProposedChangesSchema = z
  .object({
    // Allowlist of editable fields. Keep narrow — wider surface =
    // wider attack surface. `hours` removed in M7 P1.5 hotfix because
    // the Toilet model has no hours column yet — accepting it created
    // a "false success" UX where users thought their edit landed but
    // resolveAppeal silently dropped it. See M8+ TODO in
    // KNOWN_ISSUES.md to reintroduce when Toilet.hours lands.
    name: z.string().min(1).max(200).optional(),
    address: z.string().min(1).max(500).optional(),
    type: z.enum(['PUBLIC', 'MALL', 'KONBINI', 'PURCHASE']).optional(),
    floor: z.string().max(50).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'proposedChanges must include at least one field',
  })

const EvidenceSchema = z.array(z.string().min(1).max(300)).max(5).default([])

// M10 P2: reason min lowered from 10/20 → 1 across all 6 types.
// Per-type verbosity gates drove users to invent filler text ("a" × 10)
// that added no information. The evidence photo + AppealType already
// carry the signal; Haiku + admin still gate UPHELD. Kept max bounds
// unchanged (2000 / 500) as hard anti-spam backstops.
const CreateAppealInput = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('OWN_SUBMISSION_REJECT'),
    targetToiletId: z.string().min(1),
    reason: z.string().min(1).max(2000),
    evidence: EvidenceSchema,
  }),
  z.object({
    type: z.literal('REPORT_DATA_ERROR'),
    targetToiletId: z.string().min(1),
    reason: z.string().min(1).max(2000),
    evidence: EvidenceSchema,
  }),
  z.object({
    type: z.literal('SUGGEST_EDIT'),
    targetToiletId: z.string().min(1),
    reason: z.string().min(1).max(2000),
    proposedChanges: ProposedChangesSchema,
    evidence: EvidenceSchema,
  }),
  z.object({
    type: z.literal('REPORT_CLOSED'),
    targetToiletId: z.string().min(1),
    reason: z.string().min(1).max(2000),
    evidence: EvidenceSchema,
  }),
  z.object({
    type: z.literal('REPORT_NO_TOILET'),
    targetToiletId: z.string().min(1),
    reason: z.string().min(1).max(2000),
    evidence: EvidenceSchema,
  }),
  z.object({
    type: z.literal('SELF_SOFT_DELETE'),
    targetToiletId: z.string().min(1),
    reason: z.string().min(1).max(500),
  }),
])

export const appealRouter = createTRPCRouter({
  create: withUserRateLimit('appeal:create')
    .input(CreateAppealInput)
    .mutation(async ({ ctx, input }) => {
      const perm = canAppeal(ctx.user, input.type)
      if (!perm.ok) {
        throw new TRPCError({ code: 'FORBIDDEN', message: perm.reason })
      }

      const target = await ctx.db.toilet.findUnique({
        where: { id: input.targetToiletId },
        select: {
          id: true,
          status: true,
          submittedById: true,
          name: true,
          address: true,
          type: true,
          floor: true,
        },
      })
      if (!target) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'appeal.targetNotFound' })
      }

      // Per-type business validation.
      switch (input.type) {
        case 'OWN_SUBMISSION_REJECT': {
          if (target.submittedById !== ctx.user.id) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'appeal.notYourSubmission' })
          }
          if (target.status !== 'REJECTED') {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'appeal.targetNotRejected' })
          }
          break
        }
        case 'SELF_SOFT_DELETE': {
          const ownPerm = canSoftDeleteOwnToilet(ctx.user, {
            submittedById: target.submittedById,
          })
          if (!ownPerm.ok) {
            throw new TRPCError({ code: 'FORBIDDEN', message: ownPerm.reason })
          }
          if (target.status === 'REJECTED' || target.status === 'HIDDEN') {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'appeal.alreadyHidden' })
          }
          break
        }
        case 'REPORT_DATA_ERROR':
        case 'REPORT_CLOSED':
        case 'REPORT_NO_TOILET':
        case 'SUGGEST_EDIT': {
          if (target.status !== 'APPROVED') {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'appeal.targetNotApproved' })
          }
          break
        }
      }

      // SUGGEST_EDIT: reject if every proposed value already matches the
      // current Toilet row (nothing to change).
      if (input.type === 'SUGGEST_EDIT') {
        const pc = input.proposedChanges
        const nameJson = target.name as Record<string, unknown> | null
        const addressJson = target.address as Record<string, unknown> | null
        const nameUnchanged =
          pc.name === undefined ||
          (nameJson &&
            (nameJson.en === pc.name || nameJson.ja === pc.name || nameJson['zh-CN'] === pc.name))
        const addressUnchanged =
          pc.address === undefined ||
          (addressJson &&
            (addressJson.en === pc.address ||
              addressJson.ja === pc.address ||
              addressJson['zh-CN'] === pc.address))
        const typeUnchanged = pc.type === undefined || pc.type === target.type
        const floorUnchanged = pc.floor === undefined || pc.floor === target.floor
        if (nameUnchanged && addressUnchanged && typeUnchanged && floorUnchanged) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'appeal.noChangeDetected',
          })
        }
      }

      // Duplicate PENDING per (user, target) — irrespective of type,
      // consistent with P1 rule.
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
          evidence: 'evidence' in input ? (input.evidence ?? []) : [],
          proposedChanges: input.type === 'SUGGEST_EDIT' ? input.proposedChanges : undefined,
          status: 'PENDING',
        },
      })

      // Haiku pre-screen (non-blocking — failure leaves aiDecision null).
      try {
        const mod = await moderateAppeal(appeal.id)
        await ctx.db.appeal.update({
          where: { id: appeal.id },
          data: {
            aiDecision: mod.result.decision,
            aiConfidence: mod.result.confidence,
            aiReasons: mod.result.reasons,
            aiRawText: mod.rawText,
            aiModeratedAt: new Date(),
          },
        })
      } catch (e) {
        console.error(`[AI appeal moderation failed for appeal ${appeal.id}]`, e)
      }

      console.log(`[appeal] ${input.type} #${appeal.id} by ${ctx.user.id} → admin queue`)
      return { id: appeal.id, status: appeal.status }
    }),

  // M7 P2.3: include targetToilet so /me/appeals can render the
  // appeal row's title and link without a second round-trip per row.
  listMine: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.appeal.findMany({
      where: { userId: ctx.user.id },
      select: {
        id: true,
        type: true,
        targetToiletId: true,
        reason: true,
        evidence: true,
        proposedChanges: true,
        status: true,
        resolutionNote: true,
        resolvedAt: true,
        aiDecision: true,
        aiConfidence: true,
        createdAt: true,
        targetToilet: {
          select: {
            id: true,
            slug: true,
            name: true,
            type: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
  }),
})
