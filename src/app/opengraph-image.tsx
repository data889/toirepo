import { ImageResponse } from 'next/og'

// Root-site OG card. 1200×630 is Facebook / Twitter / iMessage / Slack
// unified preview size. Uses the brand teal-deep background + wordmark
// only — no per-locale copy because this image is served for the
// root (locale-agnostic) URL too.

export const runtime = 'edge'
export const alt = 'toirepo'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#51999F', // --color-teal-deep
        fontFamily: 'system-ui',
      }}
    >
      <div
        style={{
          fontSize: 200,
          fontWeight: 700,
          color: '#FDFCF9',
          letterSpacing: -6,
        }}
      >
        toirepo
      </div>
    </div>,
    size,
  )
}
