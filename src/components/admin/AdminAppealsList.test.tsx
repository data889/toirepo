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
  appealsData: null as unknown,
  appealsLoading: false,
  appealsError: false as boolean | { message: string },
  resolveAsync: vi.fn().mockResolvedValue({ id: 'a1', status: 'UPHELD' }),
  resolvePending: false,
}))
vi.mock('@/lib/trpc/client', () => ({
  api: {
    admin: {
      listAppeals: {
        useQuery: () => ({
          data: mockTrpc.appealsData,
          isLoading: mockTrpc.appealsLoading,
          isError: !!mockTrpc.appealsError,
          error: mockTrpc.appealsError || undefined,
        }),
      },
      resolveAppeal: {
        useMutation: () => ({
          mutateAsync: mockTrpc.resolveAsync,
          isPending: mockTrpc.resolvePending,
        }),
      },
    },
    photo: { getViewUrls: { useQuery: () => ({ data: {}, isLoading: false }) } },
    useUtils: () => ({
      admin: { listAppeals: { invalidate: vi.fn() } },
      toilet: {
        list: { invalidate: vi.fn() },
        getBySlug: { invalidate: vi.fn() },
      },
    }),
  },
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/map/toilet-labels', () => ({
  resolveToiletName: () => 'TgtToilet',
  resolveToiletAddress: () => 'TgtAddress',
}))

const { ImgStub } = vi.hoisted(() => ({
  ImgStub: (props: { src: string; alt?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={props.src} alt={props.alt ?? ''} />
  ),
}))
vi.mock('next/image', () => ({ default: ImgStub }))

import { AdminAppealsList } from './AdminAppealsList'

const baseTarget = {
  id: 't1',
  slug: 'tt1',
  status: 'APPROVED',
  name: { en: 'X' },
  address: { en: 'Y' },
  type: 'PUBLIC',
  floor: null,
  latitude: 35,
  longitude: 139,
  osmId: null,
  submittedById: null,
}

const sampleAppeals = [
  {
    id: 'a1',
    type: 'REPORT_CLOSED',
    reason: 'It is closed for sure',
    evidence: [],
    proposedChanges: null,
    status: 'PENDING',
    aiDecision: null,
    aiConfidence: null,
    aiReasons: [],
    createdAt: new Date('2026-04-21'),
    user: { id: 'u1', email: 'a@b.com', name: 'Alice', trustLevel: 1 },
    targetToilet: baseTarget,
  },
  {
    id: 'a2',
    type: 'SUGGEST_EDIT',
    reason: 'Name is wrong',
    evidence: [],
    proposedChanges: { name: 'NewName', floor: '3F' },
    status: 'PENDING',
    aiDecision: 'APPROVED',
    aiConfidence: 0.88,
    aiReasons: [],
    createdAt: new Date('2026-04-21'),
    user: { id: 'u2', email: 'b@b.com', name: 'Bob', trustLevel: 2 },
    targetToilet: baseTarget,
  },
]

describe('<AdminAppealsList />', () => {
  beforeEach(() => {
    mockTrpc.appealsData = { appeals: sampleAppeals, nextCursor: undefined }
    mockTrpc.appealsLoading = false
    mockTrpc.appealsError = false
    mockTrpc.resolveAsync.mockReset().mockResolvedValue({ id: 'a1', status: 'UPHELD' })
    mockTrpc.resolvePending = false
  })

  it('renders one card per appeal with type badge', () => {
    render(<AdminAppealsList />)
    expect(screen.getByText('admin.appeals.type.REPORT_CLOSED.label')).toBeInTheDocument()
    expect(screen.getByText('admin.appeals.type.SUGGEST_EDIT.label')).toBeInTheDocument()
  })

  it('SUGGEST_EDIT card renders proposedChanges diff for each changed field', () => {
    render(<AdminAppealsList />)
    expect(screen.getByText('admin.appeals.diff.name')).toBeInTheDocument()
    expect(screen.getByText('admin.appeals.diff.floor')).toBeInTheDocument()
    expect(screen.getByText('NewName')).toBeInTheDocument()
    expect(screen.getByText('3F')).toBeInTheDocument()
  })

  it('clicking Uphold opens the note dialog (does not mutate yet)', () => {
    render(<AdminAppealsList />)
    const upholdButtons = screen.getAllByText('admin.appeals.uphold')
    fireEvent.click(upholdButtons[0])
    expect(screen.getByText('admin.appeals.upholdDialogTitle')).toBeInTheDocument()
    expect(mockTrpc.resolveAsync).not.toHaveBeenCalled()
  })

  it('shows empty state when no appeals', () => {
    mockTrpc.appealsData = { appeals: [], nextCursor: undefined }
    render(<AdminAppealsList />)
    expect(screen.getByText('admin.appeals.empty')).toBeInTheDocument()
  })
})
