import { describe, it, expect, vi } from 'vitest'
import type { PrismaClient } from '@/generated/prisma'
import type { AuthUser } from './permissions'
import {
  canAccessAdmin,
  canAppeal,
  canAutoPublish,
  canConfirmToilet,
  canReviewToilet,
  canSoftDeleteOwnToilet,
  canSubmitToilet,
  canSuggestEdit,
  canUploadPhoto,
  isBanned,
} from './permissions'

const baseUser: AuthUser = {
  id: 'u1',
  role: 'USER',
  bannedAt: null,
  emailVerified: new Date(),
  trustLevel: 1,
}

const adminUser: AuthUser = { ...baseUser, role: 'ADMIN' }
const bannedUser: AuthUser = { ...baseUser, bannedAt: new Date() }
const bannedAdmin: AuthUser = { ...adminUser, bannedAt: new Date() }

describe('isBanned', () => {
  it('returns false when bannedAt is null', () => {
    expect(isBanned(baseUser)).toBe(false)
  })
  it('returns true when bannedAt is set', () => {
    expect(isBanned(bannedUser)).toBe(true)
  })
})

describe('canAccessAdmin', () => {
  it('returns false for null user', () => {
    expect(canAccessAdmin(null)).toBe(false)
  })
  it('returns false for regular user', () => {
    expect(canAccessAdmin(baseUser)).toBe(false)
  })
  it('returns true for admin', () => {
    expect(canAccessAdmin(adminUser)).toBe(true)
  })
  it('returns false for banned admin', () => {
    expect(canAccessAdmin(bannedAdmin)).toBe(false)
  })
})

describe('canAutoPublish', () => {
  it('is disabled in MVP (always false)', () => {
    expect(canAutoPublish(adminUser)).toBe(false)
    expect(canAutoPublish(baseUser)).toBe(false)
    expect(canAutoPublish(null)).toBe(false)
  })
})

function mockDb(
  overrides?: Partial<{
    toiletCount: number
    confirmationCount: number
    reviewCount: number
  }>,
): PrismaClient {
  return {
    toilet: {
      count: vi.fn().mockResolvedValue(overrides?.toiletCount ?? 1),
    },
    confirmation: {
      count: vi.fn().mockResolvedValue(overrides?.confirmationCount ?? 0),
    },
    review: {
      count: vi.fn().mockResolvedValue(overrides?.reviewCount ?? 0),
    },
  } as unknown as PrismaClient
}

describe('canSubmitToilet', () => {
  it('rejects unauthenticated', () => {
    expect(canSubmitToilet(null)).toEqual({ ok: false, reason: 'permission.mustLogin' })
  })
  it('rejects banned', () => {
    expect(canSubmitToilet(bannedUser)).toEqual({
      ok: false,
      reason: 'permission.accountBanned',
    })
  })
  it('rejects unverified email', () => {
    const unverified = { ...baseUser, emailVerified: null }
    expect(canSubmitToilet(unverified)).toEqual({
      ok: false,
      reason: 'permission.needsEmailVerification',
    })
  })
  it('accepts verified non-banned user', () => {
    expect(canSubmitToilet(baseUser)).toEqual({ ok: true })
  })
})

describe('canUploadPhoto', () => {
  it('rejects unauthenticated', async () => {
    const result = await canUploadPhoto(null, 't1', mockDb())
    expect(result).toEqual({ ok: false, reason: 'permission.mustLogin' })
  })
  it('rejects banned', async () => {
    const result = await canUploadPhoto(bannedUser, 't1', mockDb())
    expect(result).toEqual({ ok: false, reason: 'permission.accountBanned' })
  })
  it('rejects when toilet not found/approved', async () => {
    const result = await canUploadPhoto(baseUser, 't1', mockDb({ toiletCount: 0 }))
    expect(result).toEqual({ ok: false, reason: 'permission.toiletNotFound' })
  })
  it('accepts for valid user + toilet', async () => {
    const result = await canUploadPhoto(baseUser, 't1', mockDb({ toiletCount: 1 }))
    expect(result).toEqual({ ok: true })
  })
})

describe('canConfirmToilet (M7 P1 toggle semantics)', () => {
  it('rejects unauthenticated', async () => {
    const result = await canConfirmToilet(null, 't1', mockDb())
    expect(result).toEqual({ ok: false, reason: 'permission.mustLogin' })
  })
  it('rejects when toilet not approved', async () => {
    const result = await canConfirmToilet(baseUser, 't1', mockDb({ toiletCount: 0 }))
    expect(result).toEqual({ ok: false, reason: 'permission.toiletNotFound' })
  })
  it('accepts regardless of prior confirmation count (toggle semantics)', async () => {
    // M7 P1 dropped the 30-day cooldown — toggle handles repeat presses.
    const result = await canConfirmToilet(baseUser, 't1', mockDb({ confirmationCount: 5 }))
    expect(result).toEqual({ ok: true })
  })
  it('accepts with zero prior confirmations', async () => {
    const result = await canConfirmToilet(baseUser, 't1', mockDb({ confirmationCount: 0 }))
    expect(result).toEqual({ ok: true })
  })
})

describe('canReviewToilet (M7 P1 trust gating + upsert)', () => {
  const l0User: AuthUser = { ...baseUser, trustLevel: 0 }
  const unverifiedUser: AuthUser = { ...baseUser, emailVerified: null }

  it('rejects unauthenticated', async () => {
    const result = await canReviewToilet(null, 't1', mockDb())
    expect(result).toEqual({ ok: false, reason: 'permission.mustLogin' })
  })
  it('rejects unverified email', async () => {
    const result = await canReviewToilet(unverifiedUser, 't1', mockDb({ toiletCount: 1 }))
    expect(result).toEqual({ ok: false, reason: 'permission.needsEmailVerification' })
  })
  it('rejects L0 (trustLevel too low)', async () => {
    const result = await canReviewToilet(l0User, 't1', mockDb({ toiletCount: 1 }))
    expect(result).toEqual({ ok: false, reason: 'permission.trustLevelTooLow' })
  })
  it('rejects when toilet not approved', async () => {
    const result = await canReviewToilet(baseUser, 't1', mockDb({ toiletCount: 0 }))
    expect(result).toEqual({ ok: false, reason: 'permission.toiletNotFound' })
  })
  it('accepts L1 even when user already reviewed (upsert allowed)', async () => {
    // M7 P1 dropped the "already reviewed" block — procedure upserts.
    const result = await canReviewToilet(baseUser, 't1', mockDb({ reviewCount: 1 }))
    expect(result).toEqual({ ok: true })
  })
})

describe('canAppeal (M7 P1.5 · per-type trust gates)', () => {
  const l0User: AuthUser = { ...baseUser, trustLevel: 0 }
  const l1User: AuthUser = { ...baseUser, trustLevel: 1 }
  const l2User: AuthUser = { ...baseUser, trustLevel: 2 }
  const l3User: AuthUser = { ...baseUser, trustLevel: 3 }
  const unverifiedL2: AuthUser = { ...l2User, emailVerified: null }

  it('rejects unauthenticated (regardless of type)', () => {
    expect(canAppeal(null, 'OWN_SUBMISSION_REJECT')).toEqual({
      ok: false,
      reason: 'permission.mustLogin',
    })
  })
  it('rejects banned user', () => {
    expect(canAppeal(bannedUser, 'REPORT_CLOSED')).toEqual({
      ok: false,
      reason: 'permission.accountBanned',
    })
  })
  it('rejects unverified email', () => {
    expect(canAppeal(unverifiedL2, 'REPORT_DATA_ERROR')).toEqual({
      ok: false,
      reason: 'permission.needsEmailVerification',
    })
  })

  describe('L1 types (OWN_SUBMISSION_REJECT / SELF_SOFT_DELETE / REPORT_CLOSED / REPORT_NO_TOILET)', () => {
    it('rejects L0', () => {
      expect(canAppeal(l0User, 'REPORT_CLOSED')).toEqual({
        ok: false,
        reason: 'permission.trustLevelTooLow',
      })
    })
    it('accepts L1 for OWN_SUBMISSION_REJECT', () => {
      expect(canAppeal(l1User, 'OWN_SUBMISSION_REJECT')).toEqual({ ok: true })
    })
    it('accepts L1 for SELF_SOFT_DELETE', () => {
      expect(canAppeal(l1User, 'SELF_SOFT_DELETE')).toEqual({ ok: true })
    })
    it('accepts L1 for REPORT_CLOSED', () => {
      expect(canAppeal(l1User, 'REPORT_CLOSED')).toEqual({ ok: true })
    })
    it('accepts L1 for REPORT_NO_TOILET', () => {
      expect(canAppeal(l1User, 'REPORT_NO_TOILET')).toEqual({ ok: true })
    })
  })

  describe('L2 types (REPORT_DATA_ERROR / SUGGEST_EDIT)', () => {
    it('rejects L1 for REPORT_DATA_ERROR', () => {
      expect(canAppeal(l1User, 'REPORT_DATA_ERROR')).toEqual({
        ok: false,
        reason: 'permission.trustLevelTooLow',
      })
    })
    it('rejects L1 for SUGGEST_EDIT', () => {
      expect(canAppeal(l1User, 'SUGGEST_EDIT')).toEqual({
        ok: false,
        reason: 'permission.trustLevelTooLow',
      })
    })
    it('accepts L2 for REPORT_DATA_ERROR', () => {
      expect(canAppeal(l2User, 'REPORT_DATA_ERROR')).toEqual({ ok: true })
    })
    it('accepts L2 for SUGGEST_EDIT', () => {
      expect(canAppeal(l2User, 'SUGGEST_EDIT')).toEqual({ ok: true })
    })
    it('accepts L3 for all types', () => {
      expect(canAppeal(l3User, 'SUGGEST_EDIT')).toEqual({ ok: true })
      expect(canAppeal(l3User, 'REPORT_DATA_ERROR')).toEqual({ ok: true })
    })
  })
})

describe('canSoftDeleteOwnToilet (M7 P1.5)', () => {
  it('rejects unauthenticated', () => {
    expect(canSoftDeleteOwnToilet(null, { submittedById: 'u2' })).toEqual({
      ok: false,
      reason: 'permission.mustLogin',
    })
  })
  it('rejects banned', () => {
    expect(canSoftDeleteOwnToilet(bannedUser, { submittedById: bannedUser.id })).toEqual({
      ok: false,
      reason: 'permission.accountBanned',
    })
  })
  it('rejects toilet submitted by someone else', () => {
    expect(canSoftDeleteOwnToilet(baseUser, { submittedById: 'someone-else' })).toEqual({
      ok: false,
      reason: 'permission.notYourSubmission',
    })
  })
  it('rejects OSM-sourced toilet (no submitter)', () => {
    expect(canSoftDeleteOwnToilet(baseUser, { submittedById: null })).toEqual({
      ok: false,
      reason: 'permission.notYourSubmission',
    })
  })
  it('accepts own toilet', () => {
    expect(canSoftDeleteOwnToilet(baseUser, { submittedById: baseUser.id })).toEqual({
      ok: true,
    })
  })
})

describe('canSuggestEdit (M7 P1.5, alias of canAppeal SUGGEST_EDIT)', () => {
  const l1User: AuthUser = { ...baseUser, trustLevel: 1 }
  const l2User: AuthUser = { ...baseUser, trustLevel: 2 }

  it('rejects L1', () => {
    expect(canSuggestEdit(l1User)).toEqual({
      ok: false,
      reason: 'permission.trustLevelTooLow',
    })
  })
  it('accepts L2', () => {
    expect(canSuggestEdit(l2User)).toEqual({ ok: true })
  })
})
