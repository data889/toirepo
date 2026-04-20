import { z } from 'zod'

// Bounding box: [west, south, east, north]
export const BboxSchema = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
])

export const ListInputSchema = z.object({
  bbox: BboxSchema.optional(),
  limit: z.number().int().min(1).max(500).default(200),
})

export const GetBySlugInputSchema = z.object({
  slug: z.string().min(1).max(120),
})
