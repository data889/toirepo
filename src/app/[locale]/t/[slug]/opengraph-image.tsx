import { ImageResponse } from 'next/og'
import { getApi } from '@/lib/trpc/server'
import { resolveToiletAddress, resolveToiletName } from '@/lib/map/toilet-labels'

// Per-toilet OG card. Dynamic: pulls toilet name + address + type from
// the same getBySlug query the detail page runs (tRPC dedupes within a
// render cycle; OG render is a separate request but still one query).
//
// Design: type-colored left bar + name + address on teal-deep bg.
// 1200×630 unified preview size. System font stack — we could load
// Noto Sans Regular for proper CJK glyph coverage, but that's a
// ~200KB font download per edge-render; accepting system fallback
// for MVP (most OS have adequate CJK fonts; hollow boxes are a
// M12 polish candidate).

export const runtime = 'edge'
export const alt = 'toirepo'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const TYPE_COLOR: Record<string, string> = {
  PUBLIC: '#D4573A',
  MALL: '#2C6B8F',
  KONBINI: '#5C8A3A',
  PURCHASE: '#B8860B',
}

const TYPE_LABEL: Record<string, { zh: string; ja: string; en: string }> = {
  PUBLIC: { zh: '公共', ja: '公衆', en: 'Public' },
  MALL: { zh: '商场', ja: '商業施設', en: 'Mall' },
  KONBINI: { zh: '便利店', ja: 'コンビニ', en: 'Konbini' },
  PURCHASE: { zh: '需消费', ja: '要利用', en: 'Purchase' },
}

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  const api = await getApi()
  const toilet = await api.toilet.getBySlug({ slug })
  if (!toilet) {
    // Fallback when slug is unknown — render the generic OG.
    return new ImageResponse(
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#51999F',
          color: '#FDFCF9',
          fontSize: 160,
          fontWeight: 700,
          fontFamily: 'system-ui',
          letterSpacing: -6,
        }}
      >
        toirepo
      </div>,
      size,
    )
  }

  const name = resolveToiletName(toilet, locale) || 'toirepo'
  const address = resolveToiletAddress(toilet, locale) || ''
  const typeColor = TYPE_COLOR[toilet.type] ?? '#8A8578'
  const typeLabel =
    TYPE_LABEL[toilet.type]?.[locale === 'ja' ? 'ja' : locale === 'en' ? 'en' : 'zh'] ?? toilet.type

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'row',
        backgroundColor: '#FDFCF9', // --bg-paper
        fontFamily: 'system-ui',
      }}
    >
      {/* Type-colored left stripe */}
      <div
        style={{
          width: 80,
          height: '100%',
          backgroundColor: typeColor,
        }}
      />
      {/* Content column */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '80px 80px 60px',
        }}
      >
        {/* Top: brand */}
        <div
          style={{
            fontSize: 32,
            color: '#51999F',
            fontWeight: 700,
            letterSpacing: 2,
          }}
        >
          toirepo
        </div>
        {/* Middle: type badge + name */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div
            style={{
              alignSelf: 'flex-start',
              backgroundColor: typeColor,
              color: '#FDFCF9',
              fontSize: 28,
              fontWeight: 600,
              padding: '8px 20px',
              borderRadius: 8,
            }}
          >
            {typeLabel}
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: '#2C2C2A', // --color-ink-primary
              lineHeight: 1.15,
            }}
          >
            {name}
          </div>
          {address && (
            <div
              style={{
                fontSize: 32,
                color: '#5F5E5A', // --color-ink-secondary
                lineHeight: 1.3,
              }}
            >
              {address}
            </div>
          )}
        </div>
        {/* Bottom: domain */}
        <div
          style={{
            fontSize: 28,
            color: '#888780', // --color-ink-tertiary
          }}
        >
          toirepo.com
        </div>
      </div>
    </div>,
    size,
  )
}
