import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

// next-intl's useTranslations needs a NextIntlClientProvider in the
// tree to resolve real strings. For unit tests we sidestep by mocking
// the hook to echo the key — tests assert behavior on the key, not on
// translated text. Real i18n lookups are exercised in dev / e2e.
vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}))

import {
  ToiletStatusBadge,
  shouldDisplayStatusBadge,
  TOILET_STATUS_BADGE_CONFIG,
} from './ToiletStatusBadge'

describe('shouldDisplayStatusBadge', () => {
  it('returns false for APPROVED and unknown statuses', () => {
    expect(shouldDisplayStatusBadge('APPROVED')).toBe(false)
    expect(shouldDisplayStatusBadge('PENDING')).toBe(false)
    expect(shouldDisplayStatusBadge('REJECTED')).toBe(false)
    expect(shouldDisplayStatusBadge('???')).toBe(false)
  })

  it('returns true for the three displayable statuses', () => {
    expect(shouldDisplayStatusBadge('CLOSED')).toBe(true)
    expect(shouldDisplayStatusBadge('NO_TOILET_HERE')).toBe(true)
    expect(shouldDisplayStatusBadge('HIDDEN')).toBe(true)
  })
})

describe('TOILET_STATUS_BADGE_CONFIG', () => {
  it('covers exactly the displayable statuses', () => {
    expect(Object.keys(TOILET_STATUS_BADGE_CONFIG).sort()).toEqual([
      'CLOSED',
      'HIDDEN',
      'NO_TOILET_HERE',
    ])
  })
})

describe('<ToiletStatusBadge />', () => {
  it('renders nothing for APPROVED with no osmId', () => {
    const { container } = render(<ToiletStatusBadge status="APPROVED" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the OSM source label even on APPROVED when osmId is set', () => {
    const { getByTestId } = render(<ToiletStatusBadge status="APPROVED" osmId="node/123" />)
    expect(getByTestId('source-label-osm')).toBeInTheDocument()
  })

  it('renders the warning text for CLOSED', () => {
    const { getByText, getByRole } = render(<ToiletStatusBadge status="CLOSED" />)
    expect(getByRole('status')).toBeInTheDocument()
    expect(getByText(/toilet\.status\.closed/)).toBeInTheDocument()
  })

  it('renders the warning text for NO_TOILET_HERE + OSM label combined', () => {
    const { getByText, getByTestId } = render(
      <ToiletStatusBadge status="NO_TOILET_HERE" osmId="node/456" />,
    )
    expect(getByText(/toilet\.status\.noToilet/)).toBeInTheDocument()
    expect(getByTestId('source-label-osm')).toBeInTheDocument()
  })

  it('renders the HIDDEN warning', () => {
    const { getByText } = render(<ToiletStatusBadge status="HIDDEN" />)
    expect(getByText(/toilet\.status\.hidden/)).toBeInTheDocument()
  })
})
