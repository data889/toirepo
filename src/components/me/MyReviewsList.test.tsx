import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
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
  deleteAsync: vi.fn(),
  deletePending: false,
}))
vi.mock('@/lib/trpc/client', () => ({
  api: {
    review: {
      listMine: {
        useQuery: () => ({
          data: mockTrpc.data,
          isLoading: mockTrpc.loading,
          isError: mockTrpc.error,
        }),
      },
      delete: {
        useMutation: () => ({
          mutateAsync: mockTrpc.deleteAsync,
          isPending: mockTrpc.deletePending,
        }),
      },
    },
    useUtils: () => ({ review: { listMine: { invalidate: vi.fn() } } }),
  },
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/map/toilet-labels', () => ({ resolveToiletName: () => 'TestToilet' }))

import { MyReviewsList } from './MyReviewsList'

const baseToilet = {
  id: 't1',
  slug: 'tt1',
  name: { en: 'X' },
  address: { en: 'Y' },
  type: 'PUBLIC',
  status: 'APPROVED',
}

describe('<MyReviewsList />', () => {
  beforeEach(() => {
    mockTrpc.data = []
    mockTrpc.loading = false
    mockTrpc.error = false
    mockTrpc.deleteAsync.mockReset()
  })

  it('renders empty state when no reviews', () => {
    mockTrpc.data = []
    render(<MyReviewsList />)
    expect(screen.getByText('me.reviews.emptyHeading')).toBeInTheDocument()
  })

  it('renders all 4 status badges across rows', () => {
    mockTrpc.data = ['PENDING', 'APPROVED', 'REJECTED', 'HIDDEN'].map((status, i) => ({
      id: `r${i}`,
      toiletId: 't1',
      rating: 4,
      body: 'b',
      photoKeys: [],
      status,
      aiReasons: [],
      createdAt: new Date('2026-04-20'),
      updatedAt: new Date('2026-04-20'),
      toilet: baseToilet,
    }))
    render(<MyReviewsList />)
    expect(screen.getByText('me.reviews.status.PENDING')).toBeInTheDocument()
    expect(screen.getByText('me.reviews.status.APPROVED')).toBeInTheDocument()
    expect(screen.getByText('me.reviews.status.REJECTED')).toBeInTheDocument()
    expect(screen.getByText('me.reviews.status.HIDDEN')).toBeInTheDocument()
  })

  it('REJECTED row surfaces AI reasons block', () => {
    mockTrpc.data = [
      {
        id: 'r1',
        toiletId: 't1',
        rating: 1,
        body: null,
        photoKeys: [],
        status: 'REJECTED',
        aiReasons: ['spam_or_gibberish'],
        createdAt: new Date('2026-04-20'),
        updatedAt: new Date('2026-04-20'),
        toilet: baseToilet,
      },
    ]
    render(<MyReviewsList />)
    expect(screen.getByText('me.reviews.rejectReasonsHeader')).toBeInTheDocument()
    expect(screen.getByText('spam_or_gibberish')).toBeInTheDocument()
  })
})
