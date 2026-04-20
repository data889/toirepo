import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { createTRPCRouter, publicProcedure, withUserRateLimit } from '../../trpc'
import { canConfirmToilet } from '@/lib/permissions'

// Confirmation = "this toilet still exists" toggle. One row per
// (toiletId, userId); absence = not yet confirmed.
// Semantics: toggle creates on first call, deletes on second.

const ToggleInputSchema = z.object({ toiletId: z.string().min(1) })
const CountInputSchema = z.object({ toiletId: z.string().min(1) })

export const confirmationRouter = createTRPCRouter({
  toggle: withUserRateLimit('confirmation:toggle')
    .input(ToggleInputSchema)
    .mutation(async ({ ctx, input }) => {
      const perm = await canConfirmToilet(ctx.user, input.toiletId, ctx.db)
      if (!perm.ok) {
        throw new TRPCError({ code: 'FORBIDDEN', message: perm.reason })
      }

      const existing = await ctx.db.confirmation.findUnique({
        where: {
          toiletId_userId: {
            toiletId: input.toiletId,
            userId: ctx.user.id,
          },
        },
      })

      if (existing) {
        await ctx.db.confirmation.delete({ where: { id: existing.id } })
        return { confirmed: false }
      }

      await ctx.db.confirmation.create({
        data: { toiletId: input.toiletId, userId: ctx.user.id },
      })
      return { confirmed: true }
    }),

  countByToilet: publicProcedure.input(CountInputSchema).query(async ({ ctx, input }) => {
    const currentUser = ctx.session?.user
    const [count, self] = await Promise.all([
      ctx.db.confirmation.count({ where: { toiletId: input.toiletId } }),
      currentUser
        ? ctx.db.confirmation.findUnique({
            where: {
              toiletId_userId: { toiletId: input.toiletId, userId: currentUser.id },
            },
            select: { id: true },
          })
        : Promise.resolve(null),
    ])
    return { count, selfConfirmed: !!self }
  }),
})
