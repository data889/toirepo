import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'

// Note: shadcn Dialog renders into a body-level portal, so RTL's
// `container` is empty for portaled content. Use screen.* / document.* to
// reach the dialog body.

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, unknown>) => {
    if (values && 'current' in values && 'max' in values) {
      return `${namespace}.${key}(${values.current}/${values.max})`
    }
    return `${namespace}.${key}`
  },
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
  createReviewAsync: vi.fn().mockResolvedValue({ id: 'r1', status: 'PENDING' }),
  createReviewPending: false,
  createUploadAsync: vi.fn(),
  invalidate: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/trpc/client', () => ({
  api: {
    review: {
      create: {
        useMutation: () => ({
          mutateAsync: mockTrpc.createReviewAsync,
          isPending: mockTrpc.createReviewPending,
        }),
      },
    },
    photo: {
      createUploadUrl: {
        useMutation: () => ({ mutateAsync: mockTrpc.createUploadAsync }),
      },
    },
    useUtils: () => ({
      review: {
        listByToilet: { invalidate: mockTrpc.invalidate },
      },
    }),
  },
}))

// next/image stub — we don't need real image rendering and the loader
// chokes on empty src in happy-dom. Replace with a passthrough <img>.
// vi.hoisted is required because vi.mock factories are hoisted above
// `const`/`let` declarations.
const { ImgStub } = vi.hoisted(() => ({
  ImgStub: (props: { src: string; alt?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={props.src} alt={props.alt ?? ''} />
  ),
}))
vi.mock('next/image', () => ({ default: ImgStub }))

import { ReviewForm } from './ReviewForm'

describe('<ReviewForm />', () => {
  beforeEach(() => {
    mockSession.current = { status: 'authenticated', user: { id: 'u1', trustLevel: 1 } }
    mockTrpc.createReviewAsync.mockReset().mockResolvedValue({ id: 'r1', status: 'PENDING' })
    mockTrpc.createReviewPending = false
    mockRouter.push.mockReset()
  })

  it('shows loading spinner while session resolves', () => {
    mockSession.current = { status: 'loading', user: null }
    render(<ReviewForm toiletId="t1" open onClose={vi.fn()} />)
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('shows requireLogin CTA when unauthenticated', () => {
    mockSession.current = { status: 'unauthenticated', user: null }
    render(<ReviewForm toiletId="t1" open onClose={vi.fn()} />)
    expect(screen.getByText('toilet.review.form.requireLogin')).toBeInTheDocument()
  })

  it('shows trust gate when user is L0', () => {
    mockSession.current = { status: 'authenticated', user: { id: 'u1', trustLevel: 0 } }
    render(<ReviewForm toiletId="t1" open onClose={vi.fn()} />)
    expect(screen.getByText('toilet.review.form.requireTrust')).toBeInTheDocument()
  })

  it('renders form with submit disabled until rating chosen (L1+)', () => {
    render(<ReviewForm toiletId="t1" open onClose={vi.fn()} />)
    const submit = screen.getByText('toilet.review.form.submit').closest('button')
    expect(submit).toBeDisabled()
    const radios = screen.getAllByRole('radio')
    expect(radios.length).toBe(5)
    fireEvent.click(radios[2])
    expect(submit).not.toBeDisabled()
  })

  it('clicking submit calls review.create with the picked rating', async () => {
    const onClose = vi.fn()
    render(<ReviewForm toiletId="t1" open onClose={onClose} />)
    const radios = screen.getAllByRole('radio')
    fireEvent.click(radios[3]) // rating=4
    fireEvent.click(screen.getByText('toilet.review.form.submit').closest('button')!)
    await Promise.resolve()
    await Promise.resolve()
    expect(mockTrpc.createReviewAsync).toHaveBeenCalledWith({
      toiletId: 't1',
      rating: 4,
      body: undefined,
      photoKeys: [],
    })
  })
})
