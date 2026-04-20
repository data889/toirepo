import { createCallerFactory, createTRPCRouter } from './trpc'
import { adminRouter } from './routers/admin'
import { photoRouter } from './routers/photo'
import { pingRouter } from './routers/ping'
import { submissionRouter } from './routers/submission'
import { toiletRouter } from './routers/toilet'

export const appRouter = createTRPCRouter({
  ping: pingRouter,
  toilet: toiletRouter,
  photo: photoRouter,
  submission: submissionRouter,
  admin: adminRouter,
})

export type AppRouter = typeof appRouter

export const createCaller = createCallerFactory(appRouter)
