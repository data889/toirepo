import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, unknown>) => {
    if (values && 'fields' in values) return `${namespace}.${key}(${values.fields})`
    if (values && 'date' in values) return `${namespace}.${key}(${values.date})`
    return `${namespace}.${key}`
  },
  useLocale: () => 'zh-CN',
}))

vi.mock('@/i18n/navigation', () => ({
  Link: (props: { href: string; className?: string; children: React.ReactNode }) => (
    <a href={props.href} className={props.className}>
      {props.children}
    </a>
  ),
}))

const mockTrpc = vi.hoisted(() => ({
  data: null as unknown,
  loading: false,
  error: false,
}))
vi.mock('@/lib/trpc/client', () => ({
  api: {
    appeal: {
      listMine: {
        useQuery: () => ({
          data: mockTrpc.data,
          isLoading: mockTrpc.loading,
          isError: mockTrpc.error,
        }),
      },
    },
  },
}))

vi.mock('@/lib/map/toilet-labels', () => ({ resolveToiletName: () => 'Tgt' }))

import { MyAppealsList } from './MyAppealsList'

const baseTarget = {
  id: 't1',
  slug: 'tt1',
  name: { en: 'X' },
  type: 'PUBLIC',
  status: 'APPROVED',
}

function makeAppeal(overrides: Record<string, unknown>) {
  return {
    id: 'a1',
    type: 'REPORT_CLOSED',
    targetToiletId: 't1',
    reason: 'short reason',
    evidence: [],
    proposedChanges: null,
    status: 'PENDING',
    resolutionNote: null,
    resolvedAt: null,
    aiDecision: null,
    aiConfidence: null,
    createdAt: new Date('2026-04-21'),
    targetToilet: baseTarget,
    ...overrides,
  }
}

describe('<MyAppealsList />', () => {
  beforeEach(() => {
    mockTrpc.data = []
    mockTrpc.loading = false
    mockTrpc.error = false
  })

  it('renders empty state when no appeals', () => {
    render(<MyAppealsList />)
    expect(screen.getByText('me.appeals.emptyHeading')).toBeInTheDocument()
  })

  it('renders 6 different type badges across rows', () => {
    const types = [
      'REPORT_NO_TOILET',
      'REPORT_CLOSED',
      'SUGGEST_EDIT',
      'REPORT_DATA_ERROR',
      'OWN_SUBMISSION_REJECT',
      'SELF_SOFT_DELETE',
    ]
    mockTrpc.data = types.map((type, i) => makeAppeal({ id: `a${i}`, type }))
    render(<MyAppealsList />)
    types.forEach((type) => {
      expect(screen.getByText(`admin.appeals.type.${type}.shortLabel`)).toBeInTheDocument()
    })
  })

  it('UPHELD SUGGEST_EDIT row surfaces upheldEditApplied summary + admin note', () => {
    mockTrpc.data = [
      makeAppeal({
        id: 'a1',
        type: 'SUGGEST_EDIT',
        proposedChanges: { name: 'NewN', floor: '3F' },
        status: 'UPHELD',
        resolutionNote: 'Looks good',
        resolvedAt: new Date('2026-04-22'),
      }),
    ]
    render(<MyAppealsList />)
    expect(screen.getByText(/me\.appeals\.upheldEditApplied/)).toBeInTheDocument()
    expect(screen.getByText('Looks good')).toBeInTheDocument()
  })
})
