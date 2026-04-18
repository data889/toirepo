// Business-rule permission helpers. Centralize all "who can do what" decisions
// so that tRPC procedures stay thin (protectedProcedure/adminProcedure only
// check login + ADMIN role; fine-grained rules live here).
//
// Contract:
// - Static checks (user-only) return `boolean`.
// - Dynamic checks (need DB or time) return `PermissionResult = { ok: true }
//   | { ok: false; reason: string }`. `reason` is an i18n key, NOT a full
//   localized message — the call site translates at render time.

import type { PrismaClient, User, UserRole } from '@/generated/prisma'

export type PermissionResult = { ok: true } | { ok: false; reason: string }

// Minimum user shape that covers both full User rows and session.user.
// session.user is extended in src/types/next-auth.d.ts to include bannedAt
// and emailVerified so callers don't have to re-fetch the full User.
export type AuthUser = Pick<User, 'id' | 'role' | 'bannedAt' | 'emailVerified'>

// -----------------------------------------------------------
// Static checks (filled in substep B)
// -----------------------------------------------------------

export function canAccessAdmin(user: AuthUser | null | undefined): boolean {
  if (!user) return false
  if (isBanned(user)) return false
  return user.role === 'ADMIN'
}

export function canAutoPublish(_user: AuthUser | null | undefined): boolean {
  // SPEC §2.2: trusted-user auto-publish is a V1.0 feature. In MVP every
  // submission goes through the moderation queue, so this always returns
  // false. Keeping the function + signature now means callers in M5/M6
  // can wire it up today and the V1.0 flip is a single-function change.
  return false
}

export function isBanned(user: AuthUser): boolean {
  return user.bannedAt !== null
}

// -----------------------------------------------------------
// Dynamic checks (filled in substep C)
// -----------------------------------------------------------

export function canSubmitToilet(_user: AuthUser | null | undefined): PermissionResult {
  throw new Error('TODO: T2.5 C')
}

export async function canUploadPhoto(
  _user: AuthUser | null | undefined,
  _toiletId: string,
  _db: PrismaClient,
): Promise<PermissionResult> {
  throw new Error('TODO: T2.5 C')
}

export async function canConfirmToilet(
  _user: AuthUser | null | undefined,
  _toiletId: string,
  _db: PrismaClient,
): Promise<PermissionResult> {
  throw new Error('TODO: T2.5 C')
}

export async function canReviewToilet(
  _user: AuthUser | null | undefined,
  _toiletId: string,
  _db: PrismaClient,
): Promise<PermissionResult> {
  throw new Error('TODO: T2.5 C')
}

// -----------------------------------------------------------
// Data predicates (filled in substep C)
// -----------------------------------------------------------

export async function toiletExistsAndApproved(
  _toiletId: string,
  _db: PrismaClient,
): Promise<boolean> {
  throw new Error('TODO: T2.5 C')
}

// Keep UserRole re-exported for consumers that want the enum without a
// second import from '@/generated/prisma'.
export type { UserRole }
