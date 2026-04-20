import { createCallerFactory, createTRPCRouter } from './trpc'
import { pingRouter } from './routers/ping'
import { toiletRouter } from './routers/toilet'

export const appRouter = createTRPCRouter({
  ping: pingRouter,
  toilet: toiletRouter,
})

export type AppRouter = typeof appRouter

export const createCaller = createCallerFactory(appRouter)
