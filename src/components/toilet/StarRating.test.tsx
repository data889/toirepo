import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { StarRating, computeStarFills } from './StarRating'

describe('computeStarFills', () => {
  it('clamps below 0 to all zeros', () => {
    expect(computeStarFills(-2)).toEqual([0, 0, 0, 0, 0])
  })

  it('clamps above 5 to all ones', () => {
    expect(computeStarFills(7)).toEqual([1, 1, 1, 1, 1])
  })

  it('integer rating yields full or empty stars', () => {
    expect(computeStarFills(3)).toEqual([1, 1, 1, 0, 0])
    expect(computeStarFills(0)).toEqual([0, 0, 0, 0, 0])
    expect(computeStarFills(5)).toEqual([1, 1, 1, 1, 1])
  })

  it('fractional rating splits the boundary star', () => {
    const f = computeStarFills(4.3)
    expect(f.slice(0, 4)).toEqual([1, 1, 1, 1])
    expect(f[4]).toBeCloseTo(0.3)
  })
})

describe('<StarRating />', () => {
  it('uses provided ariaLabel verbatim', () => {
    const { getByRole } = render(<StarRating value={4.2} ariaLabel="four point two" />)
    expect(getByRole('img')).toHaveAttribute('aria-label', 'four point two')
  })

  it('default ariaLabel formats value to one decimal', () => {
    const { getByRole } = render(<StarRating value={3.456} />)
    expect(getByRole('img')).toHaveAttribute('aria-label', '3.5 out of 5 stars')
  })

  it('renders 5 star slots regardless of value', () => {
    const { container } = render(<StarRating value={2} />)
    // Each slot is a `<span>` inside the wrapper; count them.
    const wrapper = container.querySelector('[role="img"]')!
    const slots = wrapper.querySelectorAll(':scope > span')
    expect(slots).toHaveLength(5)
  })
})
