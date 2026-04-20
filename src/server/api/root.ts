import { createCallerFactory, createTRPCRouter } from './trpc'
import { adminRouter } from './routers/admin'
import { appealRouter } from './routers/appeal'
import { confirmationRouter } from './routers/confirmation'
import { photoRouter } from './routers/photo'
import { pingRouter } from './routers/ping'
import { reviewRouter } from './routers/review'
import { submissionRouter } from './routers/submission'
import { toiletRouter } from './routers/toilet'

export const appRouter = createTRPCRouter({
  ping: pingRouter,
  toilet: toiletRouter,
  photo: photoRouter,
  submission: submissionRouter,
  admin: adminRouter,
  review: reviewRouter,
  confirmation: confirmationRouter,
  appeal: appealRouter,
})

export type AppRouter = typeof appRouter

export const createCaller = createCallerFactory(appRouter)
