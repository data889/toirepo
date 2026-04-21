import { z } from 'zod'
import { Prisma } from '@/generated/prisma'
import { publicProcedure } from '../../trpc'

// Shape of the name/address JSON columns. Always contains zh-CN;
// ja/en may be missing (user-submitted rows pre-M8 DeepL) or
// [MT]-prefixed (post-M8). Kept local to this file — the wire-level
// contract with the client is "whatever Toilet.name holds".
type LocalizedJson = {
  'zh-CN': string
  ja?: string
  en?: string
}

// Row shape returned to the client. Mirror of the columns SELECTed
// in the query below — the raw-SQL path doesn't get Prisma's
// generated types so we hand-shape the return.
interface BboxRow {
  id: string
  slug: string
  name: LocalizedJson
  address: LocalizedJson
  type: string
  status: string
  latitude: number
  longitude: number
}

// M7 P2.1: community-warning states (CLOSED + NO_TOILET_HERE) stay
// visible alongside APPROVED; they're dimmed client-side. REJECTED /
// HIDDEN / ARCHIVED / PENDING never leak to the public map.

export const ListByBboxInputSchema = z.object({
  minLng: z.number().min(-180).max(180),
  minLat: z.number().min(-90).max(90),
  maxLng: z.number().min(-180).max(180),
  maxLat: z.number().min(-90).max(90),
  // Zoom is accepted but not used server-side — the client gates
  // queries below zoom 3 to avoid whole-earth envelopes that can't
  // fit inside the limit. Keeping it in the input makes
  // server-side logging/metrics aware of view context if needed.
  zoom: z.number().int().min(0).max(22),
  // 5000 is the ceiling the original M11 schema tolerated when
  // MapLibre's cluster aggregation was benchmarked against Tokyo's
  // 10k rows. A typical mid-zoom city viewport returns well under
  // 2000, the default. If we saturate 5000 regularly in one city
  // view, bumping the limit isn't the answer — that's a vector-tile-
  // serving conversation.
  limit: z.number().int().min(1).max(5000).default(2000),
})

// M12: viewport-bbox fetch backing MapCanvas moveend handler. Replaces
// the client's prior "pull the first 2000 rows globally" call so that
// prod's 365k+ Toilets are all reachable when users pan away from
// Tokyo. Antimeridian crossings (minLng > maxLng) are NOT supported —
// MapLibre's getBounds() normalizes to [-180, 180] and
// renderWorldCopies: false + minZoom: 2 keep the camera on one hemisphere.
export const listByBbox = publicProcedure
  .input(ListByBboxInputSchema)
  .query(async ({ ctx, input }) => {
    const { minLng, minLat, maxLng, maxLat, limit } = input

    // Raw SQL because Prisma can't express ST_Intersects against the
    // Unsupported geography column. ST_MakeEnvelope builds a polygon
    // in SRID 4326; the ::geography cast matches Toilet.location's
    // type so the existing GIST index on location is used.
    const rows = await ctx.db.$queryRaw<BboxRow[]>(Prisma.sql`
      SELECT id, slug, name, address, type::text, status::text, latitude, longitude
      FROM "Toilet"
      WHERE status IN ('APPROVED', 'CLOSED', 'NO_TOILET_HERE')
        AND ST_Intersects(
          location,
          ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326)::geography
        )
      LIMIT ${limit}
    `)
    return rows
  })
