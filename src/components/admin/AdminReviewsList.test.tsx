import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, unknown>) => {
    if (values && 'count' in values) return `${namespace}.${key}(${values.count})`
    if (values && 'percent' in values)
      return `${namespace}.${key}(${values.decision},${values.percent}%)`
    return `${namespace}.${key}`
  },
  useLocale: () => 'zh-CN',
}))

const mockTrpc = vi.hoisted(() => ({
  reviewsData: null as unknown,
  reviewsLoading: false,
  reviewsError: false as boolean | { message: string },
  resolveAsync: vi.fn().mockResolvedValue({ id: 'r1', status: 'APPROVED' }),
  resolvePending: false,
  getViewUrls: vi.fn(),
}))
vi.mock('@/lib/trpc/client', () => ({
  api: {
    admin: {
      listPendingReviews: {
        useQuery: () => ({
          data: mockTrpc.reviewsData,
          isLoading: mockTrpc.reviewsLoading,
          isError: !!mockTrpc.reviewsError,
          error: mockTrpc.reviewsError || undefined,
        }),
      },
      resolveReview: {
        useMutation: () => ({
          mutateAsync: mockTrpc.resolveAsync,
          isPending: mockTrpc.resolvePending,
        }),
      },
    },
    photo: {
      getViewUrls: { useQuery: () => ({ data: {}, isLoading: false }) },
    },
    useUtils: () => ({
      admin: { listPendingReviews: { invalidate: vi.fn() } },
      review: { listByToilet: { invalidate: vi.fn() } },
    }),
  },
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/map/toilet-labels', () => ({
  resolveToiletName: () => 'TestToilet',
}))

const { ImgStub } = vi.hoisted(() => ({
  ImgStub: (props: { src: string; alt?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={props.src} alt={props.alt ?? ''} />
  ),
}))
vi.mock('next/image', () => ({ default: ImgStub }))

import { AdminReviewsList } from './AdminReviewsList'

const sampleReviews = [
  {
    id: 'rv1',
    rating: 5,
    body: 'Great place',
    photoKeys: [],
    status: 'PENDING',
    aiDecision: 'APPROVED',
    aiConfidence: 0.92,
    aiReasons: [],
    createdAt: new Date('2026-04-20'),
    user: { id: 'u1', email: 'a@b.com', name: 'Alice', trustLevel: 1 },
    toilet: {
      id: 't1',
      slug: 'tt1',
      name: { en: 'X' },
      address: { en: 'Y' },
      type: 'PUBLIC',
      status: 'APPROVED',
    },
  },
  {
    id: 'rv2',
    rating: 1,
    body: 'spam spam spam',
    photoKeys: [],
    status: 'PENDING',
    aiDecision: 'REJECTED',
    aiConfidence: 0.95,
    aiReasons: ['spam_or_gibberish'],
    createdAt: new Date('2026-04-21'),
    user: { id: 'u2', email: 'b@b.com', name: null, trustLevel: 0 },
    toilet: {
      id: 't2',
      slug: 'tt2',
      name: { en: 'Z' },
      address: { en: 'W' },
      type: 'KONBINI',
      status: 'APPROVED',
    },
  },
]

describe('<AdminReviewsList />', () => {
  beforeEach(() => {
    mockTrpc.reviewsData = { reviews: sampleReviews, nextCursor: undefined }
    mockTrpc.reviewsLoading = false
    mockTrpc.reviewsError = false
    mockTrpc.resolveAsync.mockReset().mockResolvedValue({ id: 'r1', status: 'APPROVED' })
    mockTrpc.resolvePending = false
  })

  it('renders one card per review with AI verdict badge', () => {
    render(<AdminReviewsList />)
    // 2 review rows
    expect(screen.getAllByText('admin.reviews.approve')).toHaveLength(2)
    // AI badges
    expect(screen.getByText('admin.reviews.aiLabel(APPROVED,92%)')).toBeInTheDocument()
    expect(screen.getByText('admin.reviews.aiLabel(REJECTED,95%)')).toBeInTheDocument()
  })

  it('clicking Approve calls resolveReview with APPROVED', async () => {
    render(<AdminReviewsList />)
    const approveButtons = screen.getAllByText('admin.reviews.approve')
    fireEvent.click(approveButtons[0])
    await Promise.resolve()
    expect(mockTrpc.resolveAsync).toHaveBeenCalledWith({ reviewId: 'rv1', decision: 'APPROVED' })
  })

  it('clicking Reject opens the note dialog (does not mutate yet)', () => {
    render(<AdminReviewsList />)
    const rejectButtons = screen.getAllByText('admin.reviews.reject')
    fireEvent.click(rejectButtons[0])
    // Note dialog should now be visible
    expect(screen.getByText('admin.reviews.rejectDialogTitle')).toBeInTheDocument()
    // Mutation not called yet
    expect(mockTrpc.resolveAsync).not.toHaveBeenCalled()
  })

  it('shows empty state when no reviews', () => {
    mockTrpc.reviewsData = { reviews: [], nextCursor: undefined }
    render(<AdminReviewsList />)
    expect(screen.getByText('admin.reviews.empty')).toBeInTheDocument()
  })
})
