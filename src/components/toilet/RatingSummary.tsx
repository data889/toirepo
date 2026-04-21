'use client'

import { useTranslations } from 'next-intl'
import { StarRating } from './StarRating'

// Visual rating summary: average + per-bucket bars.
// Pure derivation in `computeRatingDistribution` so tests can verify
// math without rendering.

export interface RatingSummaryProps {
  /** Each review's 1..5 rating (just the integers, body / user not needed). */
  ratings: number[]
  className?: string
}

export interface RatingDistribution {
  average: number
  total: number
  /** index 0 = 1-star count, index 4 = 5-star count */
  buckets: [number, number, number, number, number]
}

export function computeRatingDistribution(ratings: number[]): RatingDistribution {
  const buckets: [number, number, number, number, number] = [0, 0, 0, 0, 0]
  let sum = 0
  for (const r of ratings) {
    if (r < 1 || r > 5) continue
    const idx = Math.round(r) - 1
    if (idx >= 0 && idx <= 4) {
      buckets[idx]++
      sum += r
    }
  }
  const total = buckets.reduce((a, b) => a + b, 0)
  const average = total === 0 ? 0 : sum / total
  return { average, total, buckets }
}

export function RatingSummary({ ratings, className }: RatingSummaryProps) {
  const t = useTranslations('toilet.review')
  const { average, total, buckets } = computeRatingDistribution(ratings)

  if (total === 0) {
    return <p className={`text-ink-tertiary text-sm ${className ?? ''}`}>{t('noRatings')}</p>
  }

  // Bars are normalized to the largest bucket (so the modal star is
  // always full-width, others are proportional). This reads better
  // than normalizing to total — the visual contrast survives small N.
  const maxBucket = Math.max(...buckets)
  const barWidth = (n: number) => (maxBucket === 0 ? 0 : (n / maxBucket) * 100)

  return (
    <div className={className}>
      <div className="flex items-baseline gap-2">
        <span className="text-ink-primary text-2xl font-medium tabular-nums">
          {average.toFixed(1)}
        </span>
        <StarRating value={average} size="md" />
        <span className="text-ink-tertiary text-xs">{t('totalCount', { count: total })}</span>
      </div>

      <div className="mt-2 space-y-1">
        {[5, 4, 3, 2, 1].map((star) => {
          const count = buckets[star - 1]
          return (
            <div key={star} className="flex items-center gap-2 text-xs">
              <span className="text-ink-tertiary w-3 tabular-nums">{star}</span>
              <div
                className="h-1.5 flex-1 overflow-hidden rounded-full"
                style={{ backgroundColor: 'rgb(0 0 0 / 0.06)' }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${barWidth(count)}%`,
                    backgroundColor: 'rgb(236 182 106)', // amber
                  }}
                />
              </div>
              <span className="text-ink-tertiary w-6 text-right tabular-nums">{count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
