import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, unknown>) => {
    if (values && 'lat' in values) return `${namespace}.${key}(${values.lat},${values.lng})`
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

const mockSession = vi.hoisted(() => ({
  current: { status: 'authenticated', user: { id: 'u1', trustLevel: 1 } } as {
    status: string
    user: { id: string; trustLevel: number } | null
  },
}))
vi.mock('@/hooks/useSession', () => ({ useSession: () => mockSession.current }))

const mockTrpc = vi.hoisted(() => ({
  data: null as unknown,
  loading: false,
  error: false,
}))
vi.mock('@/lib/trpc/client', () => ({
  api: {
    submission: {
      listMine: {
        useQuery: () => ({
          data: mockTrpc.data,
          isLoading: mockTrpc.loading,
          isError: mockTrpc.error,
        }),
      },
    },
    photo: { getViewUrls: { useQuery: () => ({ data: {}, isLoading: false }) } },
  },
}))

vi.mock('@/lib/map/toilet-labels', () => ({
  resolveToiletName: () => 'TestT',
  resolveToiletAddress: () => 'TestAddr',
}))

// AppealDialog mock — we don't need to render its internals here, just
// verify the parent button toggles its visibility.
vi.mock('@/components/toilet/AppealDialog', () => ({
  AppealDialog: () => <div data-testid="appeal-dialog-stub" />,
}))

const { ImgStub } = vi.hoisted(() => ({
  ImgStub: (props: { src: string; alt?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={props.src} alt={props.alt ?? ''} />
  ),
}))
vi.mock('next/image', () => ({ default: ImgStub }))

import { MySubmissionsList } from './MySubmissionsList'

function makeSub(overrides: Record<string, unknown>) {
  return {
    id: 's1',
    slug: 'tt1',
    name: { en: 'X' },
    address: { en: 'Y' },
    type: 'PUBLIC',
    status: 'APPROVED',
    floor: null,
    submittedById: 'u1',
    latitude: 35,
    longitude: 139,
    createdAt: new Date('2026-04-20'),
    photos: [],
    moderation: null,
    ...overrides,
  }
}

describe('<MySubmissionsList /> appeal button', () => {
  beforeEach(() => {
    mockSession.current = { status: 'authenticated', user: { id: 'u1', trustLevel: 1 } }
    mockTrpc.data = []
  })

  it('REJECTED row shows the appeal button', () => {
    mockTrpc.data = [makeSub({ status: 'REJECTED', moderation: { reasons: [] } })]
    render(<MySubmissionsList justSubmittedSlug={null} />)
    expect(screen.getByText('submissions.appealButton')).toBeInTheDocument()
  })

  it('APPROVED row does NOT show the appeal button', () => {
    mockTrpc.data = [makeSub({ status: 'APPROVED' })]
    render(<MySubmissionsList justSubmittedSlug={null} />)
    expect(screen.queryByText('submissions.appealButton')).toBeNull()
  })

  it('L0 user sees the button on REJECTED rows but it is disabled', () => {
    mockSession.current = { status: 'authenticated', user: { id: 'u1', trustLevel: 0 } }
    mockTrpc.data = [makeSub({ status: 'REJECTED', moderation: { reasons: [] } })]
    render(<MySubmissionsList justSubmittedSlug={null} />)
    const button = screen.getByText('submissions.appealButton').closest('button')
    expect(button).toBeDisabled()
  })
})
