import { createCallerFactory, createTRPCRouter } from './trpc'
import { pingRouter } from './routers/ping'

export const appRouter = createTRPCRouter({
  ping: pingRouter,
})

export type AppRouter = typeof appRouter

export const createCaller = createCallerFactory(appRouter)
