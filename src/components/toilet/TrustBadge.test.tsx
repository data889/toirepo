import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

import { TrustBadge, shouldShowTrustBadge } from './TrustBadge'

describe('shouldShowTrustBadge', () => {
  it('hides L0 and L1', () => {
    expect(shouldShowTrustBadge(0)).toBe(false)
    expect(shouldShowTrustBadge(1)).toBe(false)
  })

  it('shows L2 and L3', () => {
    expect(shouldShowTrustBadge(2)).toBe(true)
    expect(shouldShowTrustBadge(3)).toBe(true)
  })
})

describe('<TrustBadge />', () => {
  it('renders nothing for L0', () => {
    const { container } = render(<TrustBadge level={0} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing for L1', () => {
    const { container } = render(<TrustBadge level={1} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders verified badge for L2', () => {
    const { getByText, getByTitle } = render(<TrustBadge level={2} />)
    expect(getByText(/verified/)).toBeInTheDocument()
    expect(getByTitle('verified')).toBeInTheDocument()
  })

  it('renders senior badge for L3', () => {
    const { getByText, getByTitle } = render(<TrustBadge level={3} />)
    expect(getByText(/senior/)).toBeInTheDocument()
    expect(getByTitle('senior')).toBeInTheDocument()
  })
})
