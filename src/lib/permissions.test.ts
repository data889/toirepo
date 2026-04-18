import { describe, it, expect, vi } from 'vitest'
import type { PrismaClient } from '@/generated/prisma'
import type { AuthUser } from './permissions'
import {
  canAccessAdmin,
  canAutoPublish,
  canConfirmToilet,
  canReviewToilet,
  canSubmitToilet,
  canUploadPhoto,
  isBanned,
} from './permissions'

const baseUser: AuthUser = {
  id: 'u1',
  role: 'USER',
  bannedAt: null,
  emailVerified: new Date(),
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

describe('canConfirmToilet', () => {
  it('rejects unauthenticated', async () => {
    const result = await canConfirmToilet(null, 't1', mockDb())
    expect(result).toEqual({ ok: false, reason: 'permission.mustLogin' })
  })
  it('rejects when toilet not approved', async () => {
    const result = await canConfirmToilet(baseUser, 't1', mockDb({ toiletCount: 0 }))
    expect(result).toEqual({ ok: false, reason: 'permission.toiletNotFound' })
  })
  it('rejects within 30 day cooldown', async () => {
    const result = await canConfirmToilet(baseUser, 't1', mockDb({ confirmationCount: 1 }))
    expect(result).toEqual({ ok: false, reason: 'permission.confirmCooldown' })
  })
  it('accepts when no prior confirmation', async () => {
    const result = await canConfirmToilet(baseUser, 't1', mockDb({ confirmationCount: 0 }))
    expect(result).toEqual({ ok: true })
  })
})

describe('canReviewToilet', () => {
  it('rejects unauthenticated', async () => {
    const result = await canReviewToilet(null, 't1', mockDb())
    expect(result).toEqual({ ok: false, reason: 'permission.mustLogin' })
  })
  it('rejects when toilet not approved', async () => {
    const result = await canReviewToilet(baseUser, 't1', mockDb({ toiletCount: 0 }))
    expect(result).toEqual({ ok: false, reason: 'permission.toiletNotFound' })
  })
  it('rejects when user already reviewed', async () => {
    const result = await canReviewToilet(baseUser, 't1', mockDb({ reviewCount: 1 }))
    expect(result).toEqual({ ok: false, reason: 'permission.alreadyReviewed' })
  })
  it('accepts when no prior review', async () => {
    const result = await canReviewToilet(baseUser, 't1', mockDb({ reviewCount: 0 }))
    expect(result).toEqual({ ok: true })
  })
})
