import { cn } from '@/lib/utils'

// Pure visual primitive — fractional fill via overlaid clipping.
// 4.3 renders as 4 full stars + 1 star clipped to 30% width + 0 stars
// where the rest would be. SVG is drawn inline to keep tree-shake
// friendly and avoid a separate icon font.

const SIZE_PX = { sm: 12, md: 16, lg: 24 } as const
type Size = keyof typeof SIZE_PX

export interface StarRatingProps {
  /** 0..5, may be fractional. Out-of-range values clamp. */
  value: number
  size?: Size
  className?: string
  /** Override the per-star fill color. Defaults to amber token. */
  color?: string
  /** aria-label override; default formats `value` to one decimal. */
  ariaLabel?: string
}

const STAR_PATH =
  'M10 1.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L10 14.77 4.8 17.5l.99-5.78L1.58 7.62l5.82-.85L10 1.5z'

/**
 * Compute per-star fill ratios from a numeric rating.
 * Exported for test reuse — see StarRating.test.tsx.
 */
export function computeStarFills(value: number): number[] {
  const clamped = Math.max(0, Math.min(5, value))
  return Array.from({ length: 5 }, (_, i) => Math.max(0, Math.min(1, clamped - i)))
}

export function StarRating({
  value,
  size = 'md',
  className,
  color = 'rgb(236 182 106)', // --color-amber
  ariaLabel,
}: StarRatingProps) {
  const px = SIZE_PX[size]
  const fills = computeStarFills(value)
  const label = ariaLabel ?? `${value.toFixed(1)} out of 5 stars`

  return (
    <span
      className={cn('inline-flex items-center gap-0.5', className)}
      role="img"
      aria-label={label}
    >
      {fills.map((fill, i) => (
        <span
          key={i}
          className="relative inline-block"
          style={{ width: px, height: px }}
          aria-hidden="true"
        >
          {/* Empty star backdrop */}
          <svg
            viewBox="0 0 20 20"
            width={px}
            height={px}
            className="absolute inset-0"
            fill="none"
            stroke={color}
            strokeWidth="1.5"
          >
            <path d={STAR_PATH} />
          </svg>
          {/* Filled portion clipped horizontally */}
          {fill > 0 && (
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <svg viewBox="0 0 20 20" width={px} height={px} fill={color}>
                <path d={STAR_PATH} />
              </svg>
            </span>
          )}
        </span>
      ))}
    </span>
  )
}
