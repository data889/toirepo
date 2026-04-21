import { Prisma } from '@/generated/prisma'
import { createTRPCRouter, publicProcedure } from '../../trpc'
import { GetBySlugInputSchema, ListInputSchema } from './schemas'

// Shape of name/address as stored in Toilet's Json columns. Always
// contains all three locales when written via seed; user-submitted
// rows (M5) may have machine-translated values prefixed [MT].
type LocalizedJson = {
  'zh-CN': string
  ja?: string
  en?: string
}

// Row shape returned by the bbox raw-SQL path. Mirrors the columns
// SELECTed in the query — keep them in sync.
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

// M7 P2.1: which statuses are publicly visible on the map / drawer.
// REJECTED + HIDDEN + ARCHIVED + PENDING stay hidden. CLOSED +
// NO_TOILET_HERE join APPROVED — they're community-warning states,
// dimmed in the UI but information-bearing.
const PUBLIC_VISIBLE_STATUSES = ['APPROVED', 'CLOSED', 'NO_TOILET_HERE'] as const

export const toiletRouter = createTRPCRouter({
  list: publicProcedure.input(ListInputSchema).query(async ({ ctx, input }) => {
    const { bbox, limit } = input

    if (bbox) {
      const [west, south, east, north] = bbox
      // Raw SQL because Prisma can't express ST_Intersects against the
      // Unsupported geography column. ST_MakeEnvelope builds a polygon
      // in SRID 4326; cast to geography matches Toilet.location's type.
      const rows = await ctx.db.$queryRaw<BboxRow[]>(Prisma.sql`
        SELECT id, slug, name, address, type::text, status::text, latitude, longitude
        FROM "Toilet"
        WHERE status IN ('APPROVED', 'CLOSED', 'NO_TOILET_HERE')
          AND ST_Intersects(
            location,
            ST_MakeEnvelope(${west}, ${south}, ${east}, ${north}, 4326)::geography
          )
        LIMIT ${limit}
      `)
      return rows
    }

    // No bbox: standard Prisma query, no PostGIS round-trip.
    const rows = await ctx.db.toilet.findMany({
      where: { status: { in: [...PUBLIC_VISIBLE_STATUSES] } },
      select: {
        id: true,
        slug: true,
        name: true,
        address: true,
        type: true,
        status: true,
        latitude: true,
        longitude: true,
      },
      take: limit,
    })
    return rows
  }),

  getBySlug: publicProcedure.input(GetBySlugInputSchema).query(async ({ ctx, input }) => {
    const toilet = await ctx.db.toilet.findFirst({
      where: { slug: input.slug, status: { in: [...PUBLIC_VISIBLE_STATUSES] } },
      include: {
        photos: {
          select: {
            id: true,
            url: true,
            thumbnailUrl: true,
            width: true,
            height: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    // Return null rather than throwing — callers (page.tsx, components)
    // decide whether to render a 404 view or a fallback.
    return toilet
  }),
})
