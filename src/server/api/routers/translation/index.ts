import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { createTRPCRouter, protectedProcedure } from '../../trpc'
import { translate, type ToirepoLocale } from '@/server/deepl/client'

// Runtime translation endpoint. No current consumer — wired up so
// M8+ / submission.create can call it when a user submits text in
// one locale and we want to backfill the other two.
//
// Protected because the call itself costs DeepL chars; rate limit
// class not added yet (MVP has no real caller). When we wire
// submission.create to use it, attach `translation:submit` 20/hour.

const TranslateInputSchema = z.object({
  text: z.string().min(1).max(2000),
  target: z.enum(['zh-CN', 'ja', 'en']),
  source: z.enum(['zh-CN', 'ja', 'en']).optional(),
})

export const translationRouter = createTRPCRouter({
  translate: protectedProcedure.input(TranslateInputSchema).mutation(async ({ input }) => {
    try {
      const out = await translate(
        input.text,
        input.target,
        input.source as ToirepoLocale | undefined,
      )
      return { text: out }
    } catch (e) {
      console.error('[translation] DeepL call failed', e)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'translation.deeplFailed',
      })
    }
  }),
})
