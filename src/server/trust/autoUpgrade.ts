// Trust-level auto-upgrade (M7 P1).
//
// Ladder (Ming decision):
//   L0 → L1:  approvedSubmissions >= 1
//   L1 → L2:  approvedSubmissions >= 5 AND rejectedRate < 0.10
//   L2 → L3:  NOT automatic — requires admin manual grant. This helper
//             detects eligibility and flags it via console.log + AuditLog;
//             an admin UI (M7 P3 / post-MVP) reads that log.
//
// No automatic demotion — MVP doesn't need it. Banned users are filtered
// by canReviewToilet / canAppeal separately; trustLevel stays high.
//
// When to call:
//   - After a Toilet status transitions to APPROVED or REJECTED (admin
//     action or M6 auto-reject). Hooked into submission.create's AI
//     pipeline + admin.review.
//   - After a Review status transitions to APPROVED / REJECTED (to let
//     future extensions weight review behavior into trust; currently
//     only submission counts feed the ladder).

import { db } from '@/server/db'

const L1_SUBMISSION_MIN = 1
const L2_SUBMISSION_MIN = 5
const L2_REJECTED_RATE_MAX = 0.1 // < 10% rejection rate qualifies as "AI ~100% pass"

export type TrustUpgradeOutcome =
  | { upgraded: true; from: number; to: number }
  | { upgraded: false; reason: 'no_change' | 'eligible_for_L3_manual' | 'already_L3' }

/**
 * Recompute and potentially advance a user's trustLevel based on their
 * submission counters. Reads approvedSubmissions / rejectedSubmissions
 * (kept in sync by the submission pipeline elsewhere — this helper
 * doesn't increment them).
 *
 * Returns the outcome so callers can log / react. DB write only happens
 * when a level actually changes.
 */
export async function recalculateTrustLevel(userId: string): Promise<TrustUpgradeOutcome> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      trustLevel: true,
      approvedSubmissions: true,
      rejectedSubmissions: true,
    },
  })
  if (!user) return { upgraded: false, reason: 'no_change' }

  const { trustLevel, approvedSubmissions, rejectedSubmissions } = user
  const total = approvedSubmissions + rejectedSubmissions
  const rejectedRate = total === 0 ? 0 : rejectedSubmissions / total

  // L3 is manual; never auto-transition into or out of it.
  if (trustLevel >= 3) {
    return { upgraded: false, reason: 'already_L3' }
  }

  // Compute target level from counters.
  let target = trustLevel
  if (approvedSubmissions >= L1_SUBMISSION_MIN && trustLevel < 1) {
    target = 1
  }
  if (
    approvedSubmissions >= L2_SUBMISSION_MIN &&
    rejectedRate < L2_REJECTED_RATE_MAX &&
    trustLevel < 2
  ) {
    target = 2
  }

  if (target === trustLevel) {
    // At L2 and qualified for L3? Log the flag but don't auto-upgrade.
    if (
      trustLevel === 2 &&
      approvedSubmissions >= 20 // Ming spec: ≥20 approved is the eligibility bar for manual L3
    ) {
      console.log(
        `[trust] user ${userId} eligible for L3 grant — admin review required (${approvedSubmissions} approved, ${rejectedSubmissions} rejected)`,
      )
      await db.auditLog.create({
        data: {
          actorId: userId,
          action: 'TRUST_L3_ELIGIBLE',
          metadata: { approvedSubmissions, rejectedSubmissions },
        },
      })
      return { upgraded: false, reason: 'eligible_for_L3_manual' }
    }
    return { upgraded: false, reason: 'no_change' }
  }

  // Actually upgrade.
  await db.user.update({
    where: { id: userId },
    data: {
      trustLevel: target,
      autoTrustChecked: true,
    },
  })
  await db.auditLog.create({
    data: {
      actorId: userId,
      action: 'TRUST_LEVEL_UP',
      metadata: { from: trustLevel, to: target, approvedSubmissions, rejectedSubmissions },
    },
  })
  return { upgraded: true, from: trustLevel, to: target }
}
