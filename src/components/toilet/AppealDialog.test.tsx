import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, unknown>) => {
    if (values && 'min' in values) return `${namespace}.${key}(min=${values.min})`
    if (values && 'count' in values) return `${namespace}.${key}(${values.count})`
    return `${namespace}.${key}`
  },
  useLocale: () => 'zh-CN',
}))

const mockSession = vi.hoisted(() => ({
  current: { status: 'authenticated', user: { id: 'u1', trustLevel: 1 } } as {
    status: string
    user: { id: string; trustLevel: number } | null
  },
}))
vi.mock('@/hooks/useSession', () => ({
  useSession: () => mockSession.current,
}))

const mockRouter = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/zh-CN',
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

const mockTrpc = vi.hoisted(() => ({
  createAppealAsync: vi.fn().mockResolvedValue({ id: 'a1' }),
  createAppealPending: false,
  createUploadAsync: vi.fn(),
}))
vi.mock('@/lib/trpc/client', () => ({
  api: {
    appeal: {
      create: {
        useMutation: () => ({
          mutateAsync: mockTrpc.createAppealAsync,
          isPending: mockTrpc.createAppealPending,
        }),
      },
    },
    photo: {
      createUploadUrl: { useMutation: () => ({ mutateAsync: mockTrpc.createUploadAsync }) },
    },
  },
}))

// Stub the locale-resolved label helpers — tests don't need real JSON
// shape parsing, just stable strings to compare against.
vi.mock('@/lib/map/toilet-labels', () => ({
  resolveToiletName: () => 'CurrentName',
  resolveToiletAddress: () => 'CurrentAddress',
}))

// vi.hoisted because vi.mock factory hoists above const declarations.
const { ImgStub } = vi.hoisted(() => ({
  ImgStub: (props: { src: string; alt?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={props.src} alt={props.alt ?? ''} />
  ),
}))
vi.mock('next/image', () => ({ default: ImgStub }))

import { AppealDialog } from './AppealDialog'

const ownToilet = {
  id: 't1',
  status: 'APPROVED',
  submittedById: 'u1',
  name: { en: 'X' },
  address: { en: 'Y' },
  type: 'PUBLIC' as const,
  floor: null,
}
const otherToilet = { ...ownToilet, submittedById: 'someoneElse' }
const rejectedOwn = { ...ownToilet, status: 'REJECTED' }
// M10 P2: REPORT_CLOSED + REPORT_NO_TOILET now accept L0, so an L0
// user on an APPROVED toilet has 2 eligible options (not zero). To
// exercise emptyL0, target a toilet whose status matches NO appeal
// type — CLOSED / NO_TOILET_HERE are in PUBLIC_VISIBLE_STATUSES but
// have no appeal type with requiredStatus pointing at them.
const alreadyClosedOtherToilet = {
  ...otherToilet,
  status: 'CLOSED' as const,
}

describe('<AppealDialog />', () => {
  beforeEach(() => {
    mockSession.current = { status: 'authenticated', user: { id: 'u1', trustLevel: 1 } }
    mockTrpc.createAppealAsync.mockReset().mockResolvedValue({ id: 'a1' })
    mockTrpc.createAppealPending = false
    mockRouter.push.mockReset()
  })

  it('shows requireLogin CTA when unauthenticated', () => {
    mockSession.current = { status: 'unauthenticated', user: null }
    render(<AppealDialog open onClose={vi.fn()} toilet={otherToilet} />)
    expect(screen.getByText('toilet.appeal.requireLogin')).toBeInTheDocument()
  })

  it('shows emptyL0 when no appeal type matches the toilet status', () => {
    // Target is already CLOSED — no appeal type has requiredStatus=CLOSED,
    // so the visible list is empty regardless of trustLevel.
    mockSession.current = { status: 'authenticated', user: { id: 'u1', trustLevel: 0 } }
    render(<AppealDialog open onClose={vi.fn()} toilet={alreadyClosedOtherToilet} />)
    expect(screen.getByText('toilet.appeal.emptyL0')).toBeInTheDocument()
  })

  it('L0 user on someone else APPROVED toilet sees REPORT_NO_TOILET + REPORT_CLOSED (M10 P2)', () => {
    mockSession.current = { status: 'authenticated', user: { id: 'u1', trustLevel: 0 } }
    render(<AppealDialog open onClose={vi.fn()} toilet={otherToilet} />)
    expect(screen.getByText('toilet.appeal.type.REPORT_NO_TOILET.label')).toBeInTheDocument()
    expect(screen.getByText('toilet.appeal.type.REPORT_CLOSED.label')).toBeInTheDocument()
    // L1 ownership + L2 types still hidden
    expect(screen.queryByText('toilet.appeal.type.SUGGEST_EDIT.label')).toBeNull()
    expect(screen.queryByText('toilet.appeal.type.REPORT_DATA_ERROR.label')).toBeNull()
    expect(screen.queryByText('toilet.appeal.type.SELF_SOFT_DELETE.label')).toBeNull()
    expect(screen.queryByText('toilet.appeal.type.OWN_SUBMISSION_REJECT.label')).toBeNull()
  })

  it('L1 user on someone else approved toilet sees REPORT_NO_TOILET + REPORT_CLOSED only', () => {
    render(<AppealDialog open onClose={vi.fn()} toilet={otherToilet} />)
    expect(screen.getByText('toilet.appeal.type.REPORT_NO_TOILET.label')).toBeInTheDocument()
    expect(screen.getByText('toilet.appeal.type.REPORT_CLOSED.label')).toBeInTheDocument()
    // L2-only types hidden
    expect(screen.queryByText('toilet.appeal.type.SUGGEST_EDIT.label')).toBeNull()
    expect(screen.queryByText('toilet.appeal.type.REPORT_DATA_ERROR.label')).toBeNull()
    // ownership-required types hidden when not owner
    expect(screen.queryByText('toilet.appeal.type.SELF_SOFT_DELETE.label')).toBeNull()
    expect(screen.queryByText('toilet.appeal.type.OWN_SUBMISSION_REJECT.label')).toBeNull()
  })

  it('L1 owner on own APPROVED sees SELF_SOFT_DELETE', () => {
    render(<AppealDialog open onClose={vi.fn()} toilet={ownToilet} />)
    expect(screen.getByText('toilet.appeal.type.SELF_SOFT_DELETE.label')).toBeInTheDocument()
    // not REJECTED, so OWN_SUBMISSION_REJECT still hidden
    expect(screen.queryByText('toilet.appeal.type.OWN_SUBMISSION_REJECT.label')).toBeNull()
  })

  it('L1 owner on own REJECTED sees OWN_SUBMISSION_REJECT only (status filter)', () => {
    render(<AppealDialog open onClose={vi.fn()} toilet={rejectedOwn} />)
    expect(screen.getByText('toilet.appeal.type.OWN_SUBMISSION_REJECT.label')).toBeInTheDocument()
    // Other types require status=APPROVED
    expect(screen.queryByText('toilet.appeal.type.REPORT_CLOSED.label')).toBeNull()
    expect(screen.queryByText('toilet.appeal.type.SELF_SOFT_DELETE.label')).toBeNull()
  })

  it('L2 user sees all 4 generic types', () => {
    mockSession.current = { status: 'authenticated', user: { id: 'u1', trustLevel: 2 } }
    render(<AppealDialog open onClose={vi.fn()} toilet={otherToilet} />)
    expect(screen.getByText('toilet.appeal.type.REPORT_NO_TOILET.label')).toBeInTheDocument()
    expect(screen.getByText('toilet.appeal.type.REPORT_CLOSED.label')).toBeInTheDocument()
    expect(screen.getByText('toilet.appeal.type.SUGGEST_EDIT.label')).toBeInTheDocument()
    expect(screen.getByText('toilet.appeal.type.REPORT_DATA_ERROR.label')).toBeInTheDocument()
  })

  it('Next button is disabled until a type is chosen', () => {
    render(<AppealDialog open onClose={vi.fn()} toilet={otherToilet} />)
    const next = screen.getByText('toilet.appeal.next').closest('button')
    expect(next).toBeDisabled()
    fireEvent.click(screen.getByText('toilet.appeal.type.REPORT_CLOSED.label'))
    expect(next).not.toBeDisabled()
  })
})
