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
// M7 P1 adds trustLevel — gated permissions (review / appeal) need it.
export type AuthUser = Pick<User, 'id' | 'role' | 'bannedAt' | 'emailVerified' | 'trustLevel'>

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

export function canSubmitToilet(user: AuthUser | null | undefined): PermissionResult {
  if (!user) return { ok: false, reason: 'permission.mustLogin' }
  if (isBanned(user)) return { ok: false, reason: 'permission.accountBanned' }
  if (!user.emailVerified) {
    return { ok: false, reason: 'permission.needsEmailVerification' }
  }
  return { ok: true }
}

export async function canUploadPhoto(
  user: AuthUser | null | undefined,
  toiletId: string,
  db: PrismaClient,
): Promise<PermissionResult> {
  if (!user) return { ok: false, reason: 'permission.mustLogin' }
  if (isBanned(user)) return { ok: false, reason: 'permission.accountBanned' }
  if (!(await toiletExistsAndApproved(toiletId, db))) {
    return { ok: false, reason: 'permission.toiletNotFound' }
  }
  return { ok: true }
}

export async function canConfirmToilet(
  user: AuthUser | null | undefined,
  toiletId: string,
  db: PrismaClient,
): Promise<PermissionResult> {
  if (!user) return { ok: false, reason: 'permission.mustLogin' }
  if (isBanned(user)) return { ok: false, reason: 'permission.accountBanned' }
  if (!(await toiletExistsAndApproved(toiletId, db))) {
    return { ok: false, reason: 'permission.toiletNotFound' }
  }
  // M7 P1: SPEC §7.4's 30-day cooldown dropped in favor of toggle
  // semantics (existence of the Confirmation row = "I said yes").
  // Confirmation.toggle procedure handles create / delete both.
  return { ok: true }
}

export async function canReviewToilet(
  user: AuthUser | null | undefined,
  toiletId: string,
  db: PrismaClient,
): Promise<PermissionResult> {
  if (!user) return { ok: false, reason: 'permission.mustLogin' }
  if (isBanned(user)) return { ok: false, reason: 'permission.accountBanned' }
  if (!user.emailVerified) {
    return { ok: false, reason: 'permission.needsEmailVerification' }
  }
  if (user.trustLevel < 1) {
    return { ok: false, reason: 'permission.trustLevelTooLow' }
  }
  if (!(await toiletExistsAndApproved(toiletId, db))) {
    return { ok: false, reason: 'permission.toiletNotFound' }
  }
  // M7 P1: "already reviewed" is no longer a block — the procedure
  // upserts so the same user can update their review. The @@unique
  // at DB level still prevents accidental duplicate rows.
  return { ok: true }
}

// M7 P1.5: Appeal gate per AppealType.
//   Own-data operations (OWN_SUBMISSION_REJECT / SELF_SOFT_DELETE) and
//   low-stakes observations (REPORT_CLOSED / REPORT_NO_TOILET) require L1.
//   Operations that mutate someone else's approved data
//   (REPORT_DATA_ERROR / SUGGEST_EDIT) require L2.
//
// No admin-only appeal types today; admins act via admin.resolveAppeal.
export type AppealTypeGated =
  | 'OWN_SUBMISSION_REJECT'
  | 'REPORT_DATA_ERROR'
  | 'SUGGEST_EDIT'
  | 'REPORT_CLOSED'
  | 'REPORT_NO_TOILET'
  | 'SELF_SOFT_DELETE'

const APPEAL_TYPE_MIN_TRUST: Record<AppealTypeGated, number> = {
  OWN_SUBMISSION_REJECT: 1,
  SELF_SOFT_DELETE: 1,
  REPORT_CLOSED: 1,
  REPORT_NO_TOILET: 1,
  REPORT_DATA_ERROR: 2,
  SUGGEST_EDIT: 2,
}

export function canAppeal(
  user: AuthUser | null | undefined,
  type: AppealTypeGated,
): PermissionResult {
  if (!user) return { ok: false, reason: 'permission.mustLogin' }
  if (isBanned(user)) return { ok: false, reason: 'permission.accountBanned' }
  if (!user.emailVerified) {
    return { ok: false, reason: 'permission.needsEmailVerification' }
  }
  if (user.trustLevel < APPEAL_TYPE_MIN_TRUST[type]) {
    return { ok: false, reason: 'permission.trustLevelTooLow' }
  }
  return { ok: true }
}

// M7 P1.5: Helper used by appeal.create's SELF_SOFT_DELETE branch. Keeps
// the "is this my toilet?" ownership check out of the procedure body.
export function canSoftDeleteOwnToilet(
  user: AuthUser | null | undefined,
  toilet: { submittedById: string | null },
): PermissionResult {
  if (!user) return { ok: false, reason: 'permission.mustLogin' }
  if (isBanned(user)) return { ok: false, reason: 'permission.accountBanned' }
  if (toilet.submittedById !== user.id) {
    return { ok: false, reason: 'permission.notYourSubmission' }
  }
  return { ok: true }
}

// M7 P1.5: Thin alias for SUGGEST_EDIT eligibility. Kept as a separate
// function so call sites read "this is an edit permission check",
// making future rules (e.g. no editing within 7 days of submission) a
// single-place change.
export function canSuggestEdit(user: AuthUser | null | undefined): PermissionResult {
  return canAppeal(user, 'SUGGEST_EDIT')
}

// -----------------------------------------------------------
// Data predicates (filled in substep C)
// -----------------------------------------------------------

export async function toiletExistsAndApproved(
  toiletId: string,
  db: PrismaClient,
): Promise<boolean> {
  const count = await db.toilet.count({
    where: { id: toiletId, status: 'APPROVED' },
  })
  return count > 0
}

// Keep UserRole re-exported for consumers that want the enum without a
// second import from '@/generated/prisma'.
export type { UserRole }
