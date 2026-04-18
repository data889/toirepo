import { z } from 'zod'
import { adminProcedure, createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc'

export const pingRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ name: z.string().optional() }).optional())
    .query(({ input }) => {
      return {
        message: `Hello, ${input?.name ?? 'world'}`,
        at: new Date(),
      }
    }),

  whoami: protectedProcedure.query(({ ctx }) => {
    return {
      id: ctx.user.id,
      email: ctx.user.email,
      role: ctx.user.role,
      locale: ctx.user.locale,
    }
  }),

  adminOnly: adminProcedure.query(() => {
    return { secret: '仅管理员可见' }
  }),
})
