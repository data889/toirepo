// Hybrid moderation policy per Ming decision (M6 intro):
//
// - AI REJECTED with high confidence → auto-reject
// - Everything else (APPROVED / low-confidence REJECTED / NEEDS_HUMAN)
//   → stay PENDING for the human moderation queue (M6 P3)
//
// Kept as a pure function in its own module so M6 P3 can swap out the
// threshold or add new outcomes (AUTO_APPROVE for trusted users?) without
// touching the pipeline integration in submission.create.

export type PolicyOutcome = 'AUTO_REJECT' | 'PENDING'

// Ming's M6 intro: "AI high-confidence REJECTED → 自动 REJECTED".
// 0.85 threshold mirrors the same number the system prompt uses to
// instruct Haiku when to pick REJECTED vs NEEDS_HUMAN, so agreement
// between prompt guidance and policy decision is high.
export const HIGH_REJECT_CONFIDENCE = 0.85

// M7 P1: widened from ToiletModerationResult to the minimal structural
// shape both toilet and review moderation produce. Lets submission.create
// and review.create share the same policy without ModerationResult /
// ReviewModerationResult type coupling.
export interface PolicyInput {
  decision: 'APPROVED' | 'REJECTED' | 'NEEDS_HUMAN'
  confidence: number
}

export function applyModerationPolicy(result: PolicyInput): PolicyOutcome {
  if (result.decision === 'REJECTED' && result.confidence >= HIGH_REJECT_CONFIDENCE) {
    return 'AUTO_REJECT'
  }
  // AI APPROVED stays PENDING on purpose — MVP moderation is
  // conservative, every submission must be seen by a human before
  // going public. Relaxation lives in TRUSTED_USER auto-publish
  // (SPEC §2.2, V1.0).
  return 'PENDING'
}
