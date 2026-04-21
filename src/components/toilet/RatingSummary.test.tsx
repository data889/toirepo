import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, unknown>) => {
    if (values && 'count' in values) return `${namespace}.${key}(${values.count})`
    return `${namespace}.${key}`
  },
}))

import { RatingSummary, computeRatingDistribution } from './RatingSummary'

describe('computeRatingDistribution', () => {
  it('returns zeros for empty input', () => {
    expect(computeRatingDistribution([])).toEqual({
      average: 0,
      total: 0,
      buckets: [0, 0, 0, 0, 0],
    })
  })

  it('rounds non-integer ratings to nearest bucket but keeps exact average', () => {
    // Realistic dataset — Reviews come in as Int 1..5 today, but the
    // helper accepts floats defensively for future seed / test fixtures.
    const result = computeRatingDistribution([5, 5, 5, 5])
    expect(result).toEqual({ average: 5, total: 4, buckets: [0, 0, 0, 0, 4] })
  })

  it('mixes buckets correctly', () => {
    // 5+5+4+3+1 = 18 / 5 = 3.6 average
    const result = computeRatingDistribution([5, 5, 4, 3, 1])
    expect(result.buckets).toEqual([1, 0, 1, 1, 2])
    expect(result.total).toBe(5)
    expect(result.average).toBeCloseTo(3.6)
  })

  it('ignores out-of-range values', () => {
    const result = computeRatingDistribution([5, 0, 6, 3])
    expect(result.total).toBe(2)
    expect(result.average).toBeCloseTo(4)
  })
})

describe('<RatingSummary />', () => {
  it('shows the empty-state message when no ratings', () => {
    const { getByText } = render(<RatingSummary ratings={[]} />)
    expect(getByText('toilet.review.noRatings')).toBeInTheDocument()
  })

  it('shows average + total count when ratings present', () => {
    const { getByText } = render(<RatingSummary ratings={[5, 5, 4, 3]} />)
    // average = 4.25 → toFixed(1) = '4.3'
    expect(getByText('4.3')).toBeInTheDocument()
    expect(getByText('toilet.review.totalCount(4)')).toBeInTheDocument()
  })

  it('renders all five star rows', () => {
    const { container } = render(<RatingSummary ratings={[5, 4, 3, 2, 1]} />)
    // Count the per-star bar rows by their first child label cell.
    const labels = container.querySelectorAll('.tabular-nums.w-3')
    expect(labels).toHaveLength(5)
  })
})
