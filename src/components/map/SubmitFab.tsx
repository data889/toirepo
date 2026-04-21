'use client'

import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'

// M10 P2 redesign: circular 56×56 FAB, bottom-left. teal-deep fill,
// white plus icon centered, curved text label bent along the inside
// of the top arc. Uses SVG <textPath> against a hidden path — the
// standard browser-built-in technique for curved text on circles.
//
// Arc geometry:
//   - viewBox 56×56 (matches the circle's pixel size)
//   - text path is a semi-circle of radius 22 (inside the 28-radius
//     circle with 6px visual padding), start-angle 180° end-angle 0°
//   - M (start-x, start-y) A rx ry rotate large sweep end-x end-y
//     The sweep flag 1 traces over the TOP of the circle left→right.
//   - Actual path used below: M 6 28 A 22 22 0 0 1 50 28 — a top-arc
//     only, centered vertically at y=28.
//
// Per-locale label length differences (zh 3 chars / ja 6 / en 9) are
// absorbed by textLength + lengthAdjust='spacingAndGlyphs' which
// scales each locale's rendered glyphs to fit the fixed 44-unit
// arc length. Keeps the visual weight consistent across locales.

export function SubmitFab() {
  const t = useTranslations('toilet.submit')
  const label = t('newToilet')

  return (
    <Link
      href="/submit"
      className="fixed bottom-6 left-4 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-colors hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 md:bottom-8 md:left-6"
      style={{
        backgroundColor: 'var(--color-teal-deep, #51999F)',
        color: '#FDFCF9',
      }}
      aria-label={label}
    >
      <svg
        viewBox="0 0 56 56"
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          {/* Top-arc path: hidden, only used as a textPath reference. */}
          <path id="submit-fab-arc" d="M 8 28 A 20 20 0 0 1 48 28" fill="none" />
        </defs>
        <text fontSize="7" fontWeight="600" fill="#FDFCF9" letterSpacing="0.3">
          <textPath
            href="#submit-fab-arc"
            startOffset="50%"
            textAnchor="middle"
            textLength="60"
            lengthAdjust="spacingAndGlyphs"
          >
            {label}
          </textPath>
        </text>
      </svg>
      <Plus className="h-6 w-6 translate-y-1" strokeWidth={2.5} />
    </Link>
  )
}
