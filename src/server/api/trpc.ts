import { initTRPC, TRPCError } from '@trpc/server'
import { ZodError } from 'zod'
import superjson from 'superjson'
import type { TRPCContext } from '../trpc-context'
import { enforceLimit, extractIp } from '../ratelimit/check'
import type { LimitKey } from '../ratelimit/limits'

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }
  },
})

export const createTRPCRouter = t.router
export const createCallerFactory = t.createCallerFactory
export const publicProcedure = t.procedure

// Requires a signed-in session. Narrows ctx.session.user to non-nullable
// so downstream procedures can read fields without optional chaining.
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      user: ctx.session.user,
    },
  })
})

// Requires role=ADMIN. Composes on top of protectedProcedure so auth
// check runs first (UNAUTHORIZED wins over FORBIDDEN for anonymous).
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== 'ADMIN') {
    throw new TRPCError({ code: 'FORBIDDEN' })
  }
  return next({ ctx })
})

// Ratelimit middleware factories (T2.4). Call at the procedure builder
// level rather than on each mutation so the limit key is part of the
// route definition, not scattered inside the handler body.
//
// Example usage in later milestones:
//   submit: withUserRateLimit('toilet:submit:hourly')
//     .input(toiletSubmitSchema)
//     .mutation(...)
//
//   submitOwnerDispute: withIpRateLimit('dispute:submit')
//     .input(ownerDisputeSchema)
//     .mutation(...)

// For operations that require a signed-in user: bucket by userId.
export function withUserRateLimit(key: LimitKey) {
  return protectedProcedure.use(async ({ ctx, next }) => {
    await enforceLimit(key, { kind: 'user', userId: ctx.user.id })
    return next({ ctx })
  })
}

// For public operations that must still be throttled: bucket by IP.
export function withIpRateLimit(key: LimitKey) {
  return publicProcedure.use(async ({ ctx, next }) => {
    const ip = extractIp(ctx.headers)
    await enforceLimit(key, { kind: 'ip', ip })
    return next({ ctx })
  })
}
