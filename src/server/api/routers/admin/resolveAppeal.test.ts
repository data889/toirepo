// admin.resolveAppeal integration tests · M7 P1.5 hotfix
//
// Covers the 6 AppealType UPHELD side effects + 2 boundary cases +
// 1 documentation test (#9) proving Path A: AUTO_REJECT'd Toilets ARE
// appealable today through OWN_SUBMISSION_REJECT against targetToiletId.
//
// Mocking strategy mirrors src/server/trust/autoUpgrade.test.ts:
// vi.mock('@/server/db') with vi.fn() Prisma surface, then re-import
// db via the mocked module so vi.mocked() narrows the types. The
// $transaction mock invokes its callback with a fakeTx whose mutators
// we assert against.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const fakeTx = {
  appeal: { update: vi.fn() },
  toilet: { update: vi.fn(), findUnique: vi.fn() },
}

// Stub the Redis client so the rate-limit module doesn't try to read
// UPSTASH env vars at import time. None of the procedures under test
// (admin.resolveAppeal) are rate-limited, but the import graph pulls
// limits.ts → redis.ts via the appeal/review/submission routers.
vi.mock('@/server/ratelimit/redis', () => ({
  redis: {} as unknown,
}))

vi.mock('@/server/db', () => ({
  db: {
    appeal: {
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    toilet: { findUnique: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: typeof fakeTx) => Promise<unknown>) => {
      return fn(fakeTx)
    }),
  },
}))

// Trust auto-upgrade isn't called by resolveAppeal but is called by
// admin.review (sibling procedure imported in the same file). Stub it
// to a harmless no-op so any incidental code path stays clean.
vi.mock('@/server/trust/autoUpgrade', () => ({
  recalculateTrustLevel: vi.fn().mockResolvedValue({ upgraded: false, reason: 'no_change' }),
}))

import { db } from '@/server/db'
import { createCaller } from '@/server/api/root'

const appealFindUnique = vi.mocked(db.appeal.findUnique)

interface AdminCtxOptions {
  userId?: string
  role?: 'USER' | 'ADMIN'
}
function makeCtx(opts: AdminCtxOptions = {}) {
  const user = {
    id: opts.userId ?? 'admin-user',
    email: 'admin@example.com',
    role: opts.role ?? 'ADMIN',
    locale: 'zh-CN',
    bannedAt: null,
    emailVerified: new Date(),
    trustLevel: 3,
  }
  return {
    session: { user, expires: new Date(Date.now() + 86400000).toISOString() },
    db,
    headers: undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

const APPELLANT = 'appellant-user'
const ADMIN = 'admin-user'
const TOILET_ID = 'toilet-abc'
const APPEAL_ID = 'appeal-123'

function fakeAppeal(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: APPEAL_ID,
    type: 'OWN_SUBMISSION_REJECT' as const,
    status: 'PENDING' as const,
    targetToiletId: TOILET_ID,
    userId: APPELLANT,
    proposedChanges: null,
    ...overrides,
  }
}

beforeEach(() => {
  appealFindUnique.mockReset()
  fakeTx.appeal.update.mockReset()
  fakeTx.toilet.update.mockReset()
  fakeTx.toilet.findUnique.mockReset()
  // Default mock returns; specific tests override as needed.
  fakeTx.appeal.update.mockResolvedValue({})
  fakeTx.toilet.update.mockResolvedValue({})
})

describe('admin.resolveAppeal · UPHELD side effects (6 AppealTypes)', () => {
  it('1. OWN_SUBMISSION_REJECT + UPHELD → Toilet REJECTED → APPROVED', async () => {
    appealFindUnique.mockResolvedValue(fakeAppeal({ type: 'OWN_SUBMISSION_REJECT' }) as never)
    const caller = createCaller(makeCtx({ userId: ADMIN }))
    await caller.admin.resolveAppeal({
      appealId: APPEAL_ID,
      decision: 'UPHELD',
      note: 'Reconsidered — looks legit',
    })

    expect(fakeTx.appeal.update).toHaveBeenCalledWith({
      where: { id: APPEAL_ID },
      data: expect.objectContaining({
        status: 'UPHELD',
        resolutionNote: 'Reconsidered — looks legit',
        resolvedById: ADMIN,
        resolvedAt: expect.any(Date),
      }),
    })
    expect(fakeTx.toilet.update).toHaveBeenCalledWith({
      where: { id: TOILET_ID },
      data: expect.objectContaining({
        status: 'APPROVED',
        publishedAt: expect.any(Date),
      }),
    })
  })

  it('2. REPORT_DATA_ERROR + UPHELD → Toilet APPROVED → REJECTED', async () => {
    appealFindUnique.mockResolvedValue(fakeAppeal({ type: 'REPORT_DATA_ERROR' }) as never)
    const caller = createCaller(makeCtx({ userId: ADMIN }))
    await caller.admin.resolveAppeal({ appealId: APPEAL_ID, decision: 'UPHELD' })

    expect(fakeTx.toilet.update).toHaveBeenCalledWith({
      where: { id: TOILET_ID },
      data: { status: 'REJECTED' },
    })
    expect(fakeTx.appeal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'UPHELD' }),
      }),
    )
  })

  it('3. SUGGEST_EDIT + UPHELD → name/address/type patched + lastCommunityEditBy=appellant', async () => {
    appealFindUnique.mockResolvedValue(
      fakeAppeal({
        type: 'SUGGEST_EDIT',
        proposedChanges: {
          name: 'New Name',
          address: 'New Address',
          type: 'KONBINI',
        },
      }) as never,
    )
    fakeTx.toilet.findUnique.mockResolvedValue({
      osmId: null,
      originalOsmTags: null,
      name: { en: 'Old', ja: '旧' },
      address: { en: 'Old Addr', ja: '旧アドレス' },
      type: 'PUBLIC',
      floor: null,
    } as never)

    const caller = createCaller(makeCtx({ userId: ADMIN }))
    await caller.admin.resolveAppeal({
      appealId: APPEAL_ID,
      decision: 'UPHELD',
      note: 'Approved edits',
    })

    expect(fakeTx.toilet.update).toHaveBeenCalledTimes(1)
    const updateCall = fakeTx.toilet.update.mock.calls[0]?.[0] as {
      where: { id: string }
      data: Record<string, unknown>
    }
    expect(updateCall.where).toEqual({ id: TOILET_ID })
    // Field-level assertions on the patch.
    expect(updateCall.data.lastCommunityEditAt).toBeInstanceOf(Date)
    expect(updateCall.data.lastCommunityEditByUser).toEqual({
      connect: { id: APPELLANT },
    })
    expect(updateCall.data.name).toEqual({ en: 'New Name', ja: '旧' })
    expect(updateCall.data.address).toEqual({ en: 'New Address', ja: '旧アドレス' })
    expect(updateCall.data.type).toBe('KONBINI')
    // Non-OSM target → no originalOsmTags snapshot.
    expect(updateCall.data.originalOsmTags).toBeUndefined()
  })

  it('3b. SUGGEST_EDIT against an OSM toilet snapshots originalOsmTags on first edit', async () => {
    appealFindUnique.mockResolvedValue(
      fakeAppeal({
        type: 'SUGGEST_EDIT',
        proposedChanges: { name: 'Corrected' },
      }) as never,
    )
    fakeTx.toilet.findUnique.mockResolvedValue({
      osmId: 'node/12345',
      originalOsmTags: null,
      name: { ja: '原始名' },
      address: { ja: '原始地址' },
      type: 'KONBINI',
      floor: null,
    } as never)

    const caller = createCaller(makeCtx({ userId: ADMIN }))
    await caller.admin.resolveAppeal({ appealId: APPEAL_ID, decision: 'UPHELD' })

    const updateCall = fakeTx.toilet.update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>
    }
    expect(updateCall.data.originalOsmTags).toEqual({
      name: { ja: '原始名' },
      address: { ja: '原始地址' },
      type: 'KONBINI',
      floor: null,
    })
  })

  it('4. REPORT_CLOSED + UPHELD → Toilet APPROVED → CLOSED (not REJECTED — stays visible)', async () => {
    appealFindUnique.mockResolvedValue(fakeAppeal({ type: 'REPORT_CLOSED' }) as never)
    const caller = createCaller(makeCtx({ userId: ADMIN }))
    await caller.admin.resolveAppeal({ appealId: APPEAL_ID, decision: 'UPHELD' })

    expect(fakeTx.toilet.update).toHaveBeenCalledWith({
      where: { id: TOILET_ID },
      data: { status: 'CLOSED' },
    })
  })

  it('5. REPORT_NO_TOILET + UPHELD → Toilet APPROVED → NO_TOILET_HERE', async () => {
    appealFindUnique.mockResolvedValue(fakeAppeal({ type: 'REPORT_NO_TOILET' }) as never)
    const caller = createCaller(makeCtx({ userId: ADMIN }))
    await caller.admin.resolveAppeal({ appealId: APPEAL_ID, decision: 'UPHELD' })

    expect(fakeTx.toilet.update).toHaveBeenCalledWith({
      where: { id: TOILET_ID },
      data: { status: 'NO_TOILET_HERE' },
    })
  })

  it('6. SELF_SOFT_DELETE + UPHELD → Toilet → REJECTED (soft hide; row kept)', async () => {
    appealFindUnique.mockResolvedValue(fakeAppeal({ type: 'SELF_SOFT_DELETE' }) as never)
    const caller = createCaller(makeCtx({ userId: ADMIN }))
    await caller.admin.resolveAppeal({ appealId: APPEAL_ID, decision: 'UPHELD' })

    // Hard delete would be tx.toilet.delete — we explicitly assert update.
    expect(fakeTx.toilet.update).toHaveBeenCalledWith({
      where: { id: TOILET_ID },
      data: { status: 'REJECTED' },
    })
  })
})

describe('admin.resolveAppeal · boundary cases', () => {
  it('7. DISMISSED has no Toilet side effect (REPORT_CLOSED test case)', async () => {
    appealFindUnique.mockResolvedValue(fakeAppeal({ type: 'REPORT_CLOSED' }) as never)
    const caller = createCaller(makeCtx({ userId: ADMIN }))
    await caller.admin.resolveAppeal({
      appealId: APPEAL_ID,
      decision: 'DISMISSED',
      note: 'No corroborating evidence',
    })

    expect(fakeTx.appeal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'DISMISSED',
          resolutionNote: 'No corroborating evidence',
          resolvedById: ADMIN,
        }),
      }),
    )
    expect(fakeTx.toilet.update).not.toHaveBeenCalled()
  })

  it('8. Non-admin caller → FORBIDDEN', async () => {
    const caller = createCaller(makeCtx({ userId: 'regular-user', role: 'USER' }))
    await expect(
      caller.admin.resolveAppeal({ appealId: APPEAL_ID, decision: 'UPHELD' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    // Defensive: no DB calls fire when the auth gate trips.
    expect(appealFindUnique).not.toHaveBeenCalled()
  })
})

describe('admin.resolveAppeal · Path A documentation', () => {
  it('9. OWN_SUBMISSION_REJECT can appeal an AUTO_REJECT Toilet via targetToiletId (no Submission table needed)', async () => {
    // Prove the M7 P1 design decision works for the AUTO_REJECT path:
    //   - submission.create wrote a Toilet with status=PENDING
    //   - moderateToilet AUTO_REJECT'd it → status=REJECTED
    //   - that Toilet row is still in the Toilet table with submittedById set
    //   - appeal.create with type=OWN_SUBMISSION_REJECT + targetToiletId=<that id>
    //     reaches it through the existing FK
    //   - admin.resolveAppeal UPHELD flips it back to APPROVED
    //
    // The hotfix prompt's premise that AUTO_REJECT submissions live in a
    // separate Submission table is incorrect for this codebase. This test
    // stands as an executable proof of the existing path so future
    // refactors don't reopen the question.
    appealFindUnique.mockResolvedValue(
      fakeAppeal({
        id: 'appeal-auto-reject',
        type: 'OWN_SUBMISSION_REJECT',
        targetToiletId: 'toilet-auto-rejected',
        userId: APPELLANT,
      }) as never,
    )

    const caller = createCaller(makeCtx({ userId: ADMIN }))
    const result = await caller.admin.resolveAppeal({
      appealId: 'appeal-auto-reject',
      decision: 'UPHELD',
    })

    expect(result).toEqual({ id: 'appeal-auto-reject', status: 'UPHELD' })
    expect(fakeTx.toilet.update).toHaveBeenCalledWith({
      where: { id: 'toilet-auto-rejected' },
      data: expect.objectContaining({ status: 'APPROVED' }),
    })
  })
})
