import { describe, it, expect, vi, beforeEach } from 'vitest'

// vitest hoists vi.mock() above module imports, so the factory can't
// reference outer-scope variables. Define the fake inside the factory,
// then re-import it via `vi.hoisted` + the mocked module in the test
// body. Alternative: use `vi.mocked(db.user.findUnique)` after the
// import — which is what we do here.

vi.mock('@/server/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}))

import { db } from '@/server/db'
import { recalculateTrustLevel } from './autoUpgrade'

// Narrow the vi.fn mocks via vi.mocked so TS + assertions know their shape.
const findUnique = vi.mocked(db.user.findUnique)
const userUpdate = vi.mocked(db.user.update)
const auditCreate = vi.mocked(db.auditLog.create)

interface MockUser {
  id: string
  trustLevel: number
  approvedSubmissions: number
  rejectedSubmissions: number
}

function mockUser(partial: Partial<MockUser> = {}): MockUser {
  return {
    id: 'u1',
    trustLevel: 0,
    approvedSubmissions: 0,
    rejectedSubmissions: 0,
    ...partial,
  }
}

describe('recalculateTrustLevel', () => {
  beforeEach(() => {
    findUnique.mockReset()
    userUpdate.mockReset()
    auditCreate.mockReset()
    // findUnique returns MockUser typed as never in Prisma's fancy generics —
    // cast at mock boundary so the tests don't wrestle the type system.
    userUpdate.mockResolvedValue({} as never)
    auditCreate.mockResolvedValue({} as never)
  })

  it('promotes L0 → L1 at 1 approved submission', async () => {
    findUnique.mockResolvedValue(mockUser({ trustLevel: 0, approvedSubmissions: 1 }) as never)
    const result = await recalculateTrustLevel('u1')
    expect(result).toEqual({ upgraded: true, from: 0, to: 1 })
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({ trustLevel: 1 }),
      }),
    )
  })

  it('promotes L1 → L2 at 5 approved + <10% reject rate', async () => {
    findUnique.mockResolvedValue(
      mockUser({ trustLevel: 1, approvedSubmissions: 10, rejectedSubmissions: 0 }) as never,
    )
    const result = await recalculateTrustLevel('u1')
    expect(result).toEqual({ upgraded: true, from: 1, to: 2 })
  })

  it('withholds L1 → L2 when rejected rate is too high', async () => {
    // 5 approved, 2 rejected = 2/7 ≈ 28.6% > 10% threshold
    findUnique.mockResolvedValue(
      mockUser({ trustLevel: 1, approvedSubmissions: 5, rejectedSubmissions: 2 }) as never,
    )
    const result = await recalculateTrustLevel('u1')
    expect(result).toEqual({ upgraded: false, reason: 'no_change' })
    expect(userUpdate).not.toHaveBeenCalled()
  })

  it('never auto-promotes L2 → L3; flags eligibility at ≥20 approved', async () => {
    findUnique.mockResolvedValue(
      mockUser({ trustLevel: 2, approvedSubmissions: 25, rejectedSubmissions: 0 }) as never,
    )
    const result = await recalculateTrustLevel('u1')
    expect(result).toEqual({ upgraded: false, reason: 'eligible_for_L3_manual' })
    expect(userUpdate).not.toHaveBeenCalled()
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'TRUST_L3_ELIGIBLE' }),
      }),
    )
  })

  it('no-ops at L3 (manual only; no demotion)', async () => {
    findUnique.mockResolvedValue(
      mockUser({ trustLevel: 3, approvedSubmissions: 0, rejectedSubmissions: 100 }) as never,
    )
    const result = await recalculateTrustLevel('u1')
    expect(result).toEqual({ upgraded: false, reason: 'already_L3' })
    expect(userUpdate).not.toHaveBeenCalled()
  })

  it('returns no_change for missing user', async () => {
    findUnique.mockResolvedValue(null as never)
    const result = await recalculateTrustLevel('u1')
    expect(result).toEqual({ upgraded: false, reason: 'no_change' })
  })
})
