import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { createTRPCRouter, protectedProcedure, withUserRateLimit } from '../../trpc'
import { canSubmitToilet } from '@/lib/permissions'
import { moderateToilet } from '@/server/anthropic/moderation'
import { applyModerationPolicy } from '@/server/anthropic/moderation-policy'

const LocalizedStringSchema = z
  .object({
    'zh-CN': z.string().max(200).optional(),
    ja: z.string().max(200).optional(),
    en: z.string().max(200).optional(),
  })
  .refine((obj) => Object.values(obj).some((v) => typeof v === 'string' && v.length > 0), {
    message: 'At least one locale must have a non-empty value',
  })

const PhotoInputSchema = z.object({
  // url stores the R2 object key (e.g. submissions/{uid}/orig/{photoid}.webp)
  // — NOT a public HTTP URL. Photos live in a private bucket per
  // Ming-decision A.1; clients render via photo.getViewUrls.
  url: z.string().min(1).max(300),
  thumbnailUrl: z.string().min(1).max(300),
  width: z.number().int().positive().max(10000),
  height: z.number().int().positive().max(10000),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024),
  category: z.enum(['ENTRANCE', 'SIGNAGE', 'EXTERIOR', 'BUILDING']).default('ENTRANCE'),
})

const CreateInputSchema = z.object({
  name: LocalizedStringSchema,
  address: LocalizedStringSchema,
  type: z.enum(['PUBLIC', 'MALL', 'KONBINI', 'PURCHASE']),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  // accessNote replaces the prompt's `description` per SPEC §5.2 — this
  // is the "进入路径说明" multi-locale field that's the project's core
  // differentiator. Optional because not every submission has access info.
  accessNote: LocalizedStringSchema.optional(),
  photos: z.array(PhotoInputSchema).min(1).max(4),
})

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export const submissionRouter = createTRPCRouter({
  create: withUserRateLimit('toilet:submit:hourly')
    .input(CreateInputSchema)
    .mutation(async ({ ctx, input }) => {
      const perm = canSubmitToilet(ctx.user)
      if (!perm.ok) {
        throw new TRPCError({ code: 'FORBIDDEN', message: perm.reason })
      }

      // Slug: prefer English (URL-friendly), fall back to ja, then zh-CN.
      const nameForSlug = input.name.en || input.name.ja || input.name['zh-CN'] || 'toilet'
      const baseSlug = slugify(nameForSlug) || 'toilet'
      let slug = baseSlug
      let suffix = 2
      while (await ctx.db.toilet.findFirst({ where: { slug } })) {
        slug = `${baseSlug}-${suffix}`
        suffix++
        if (suffix > 100) {
          // Safety: avoid infinite loop on adversarial collision storms.
          slug = `${baseSlug}-${Date.now()}`
          break
        }
      }

      const toilet = await ctx.db.$transaction(async (tx) => {
        const t = await tx.toilet.create({
          data: {
            slug,
            name: input.name,
            address: input.address,
            type: input.type,
            latitude: input.latitude,
            longitude: input.longitude,
            accessNote: input.accessNote ?? undefined,
            status: 'PENDING',
            submittedById: ctx.user.id,
          },
        })

        await tx.photo.createMany({
          data: input.photos.map((p) => ({
            toiletId: t.id,
            userId: ctx.user.id,
            url: p.url,
            thumbnailUrl: p.thumbnailUrl,
            width: p.width,
            height: p.height,
            sizeBytes: p.sizeBytes,
            category: p.category,
          })),
        })

        return t
      })

      // AI moderation: synchronous await per Ming's M6 P2 call — ~2-3s
      // model round-trip is acceptable for MVP submission UX (total
      // 4-5s vs 1-2s). Failure mode is "stay PENDING for human queue"
      // so the client always gets a usable response even if Haiku or
      // R2 hiccups mid-call.
      let finalStatus: 'PENDING' | 'REJECTED' = 'PENDING'
      try {
        const { result } = await moderateToilet(toilet.id)
        const outcome = applyModerationPolicy(result)
        if (outcome === 'AUTO_REJECT') {
          await ctx.db.toilet.update({
            where: { id: toilet.id },
            data: { status: 'REJECTED' },
          })
          finalStatus = 'REJECTED'
        }
      } catch (e) {
        console.error(`[AI moderation failed for toilet ${toilet.id}]`, e)
        // Intentional swallow — PENDING fallback is the desired UX when
        // the AI layer is down. M6 P3 admin queue will surface these.
      }

      return {
        id: toilet.id,
        slug: toilet.slug,
        status: finalStatus,
      }
    }),

  listMine: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(100).default(50),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.toilet.findMany({
        where: { submittedById: ctx.user.id },
        select: {
          id: true,
          slug: true,
          name: true,
          address: true,
          type: true,
          status: true,
          latitude: true,
          longitude: true,
          createdAt: true,
          photos: {
            select: {
              id: true,
              url: true,
              thumbnailUrl: true,
              width: true,
              height: true,
              category: true,
            },
            orderBy: { createdAt: 'asc' },
          },
          // M6 P2: surface the latest AI decision + reasons so the UI
          // can show a rejection explanation on the submitter's own
          // /me/submissions page.
          moderation: {
            select: {
              decision: true,
              confidence: true,
              reasons: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: input?.limit ?? 50,
      })
      return rows
    }),
})
