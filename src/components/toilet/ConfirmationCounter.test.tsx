import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

// next-intl mock — same pattern as RatingSummary.test.tsx
vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, unknown>) => {
    if (values && 'count' in values) return `${namespace}.${key}(${values.count})`
    return `${namespace}.${key}`
  },
}))

// useSession + i18n navigation mocks — assignable across tests
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

// Toast — only need the fns to be callable
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

// tRPC client mock — controllable per test
const mockState = vi.hoisted(() => ({
  countData: { count: 5, selfConfirmed: false } as { count: number; selfConfirmed: boolean } | null,
  countLoading: false,
  toggleMutate: vi.fn(),
  togglePending: false,
}))
vi.mock('@/lib/trpc/client', () => ({
  api: {
    confirmation: {
      countByToilet: {
        useQuery: () => ({
          data: mockState.countData,
          isLoading: mockState.countLoading,
        }),
      },
      toggle: {
        useMutation: () => ({
          mutate: mockState.toggleMutate,
          isPending: mockState.togglePending,
        }),
      },
    },
    useUtils: () => ({
      confirmation: {
        countByToilet: {
          cancel: vi.fn().mockResolvedValue(undefined),
          getData: vi.fn(),
          setData: vi.fn(),
          invalidate: vi.fn().mockResolvedValue(undefined),
        },
      },
    }),
  },
}))

import { ConfirmationCounter } from './ConfirmationCounter'

describe('<ConfirmationCounter />', () => {
  beforeEach(() => {
    mockSession.current = { status: 'authenticated', user: { id: 'u1', trustLevel: 1 } }
    mockState.countData = { count: 5, selfConfirmed: false }
    mockState.countLoading = false
    mockState.togglePending = false
    mockState.toggleMutate.mockReset()
    mockRouter.push.mockReset()
  })

  it('renders count + outline action button when not self-confirmed', () => {
    const { getByRole, getByText } = render(<ConfirmationCounter toiletId="t1" />)
    expect(getByText('toilet.confirmation.count(5)')).toBeInTheDocument()
    expect(getByRole('button')).toHaveTextContent('toilet.confirmation.action')
  })

  it('renders selfConfirmed state when count.selfConfirmed=true', () => {
    mockState.countData = { count: 6, selfConfirmed: true }
    const { getByRole } = render(<ConfirmationCounter toiletId="t1" />)
    expect(getByRole('button')).toHaveTextContent('toilet.confirmation.selfConfirmed')
  })

  it('clicking button triggers toggle mutation when authenticated', () => {
    const { getByRole } = render(<ConfirmationCounter toiletId="t1" />)
    fireEvent.click(getByRole('button'))
    expect(mockState.toggleMutate).toHaveBeenCalledWith({ toiletId: 't1' })
    expect(mockRouter.push).not.toHaveBeenCalled()
  })

  it('anonymous click routes to signin instead of mutating', () => {
    mockSession.current = { status: 'unauthenticated', user: null }
    const { getByRole } = render(<ConfirmationCounter toiletId="t1" />)
    fireEvent.click(getByRole('button'))
    expect(mockState.toggleMutate).not.toHaveBeenCalled()
    expect(mockRouter.push).toHaveBeenCalledTimes(1)
    expect(String(mockRouter.push.mock.calls[0][0])).toContain('/auth/signin?callbackUrl=')
  })
})
