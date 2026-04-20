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
  // Limits bumped in M11 to carry the OSM-scale dataset (~10k toilets).
  // MapLibre's cluster aggregation handles a few thousand markers before
  // the main thread stalls; 2000 default trades coverage (no "missing
  // marker" at edge wards) for initial-load speed. Bbox queries let
  // callers stay within safe density without ever touching the ceiling.
  limit: z.number().int().min(1).max(5000).default(2000),
})

export const GetBySlugInputSchema = z.object({
  slug: z.string().min(1).max(120),
})
