-- M7 P1.5 · Appeal expansion.
--
-- Covers:
--   1. Swap AppealType enum (rename BAD_APPROVED_DATA → REPORT_DATA_ERROR,
--      add 4 new values) in one atomic type swap. PostgreSQL cannot DROP
--      an enum value directly, so we create a new type, migrate column
--      refs with a CASE, drop old type, rename new type.
--      DB is empty of Appeal rows at migration time; the CASE still
--      handles any late inserts between DDL statements.
--   2. Add CLOSED + NO_TOILET_HERE to ToiletStatus (simple ADD VALUE).
--   3. Add Appeal columns: proposedChanges + 5 AI columns.
--   4. Add Toilet columns: lastCommunityEditAt/By + originalOsmTags.
--   5. CHECK constraints:
--        - Appeal targetToiletId NOT NULL (all 6 types target a Toilet).
--        - Appeal.type=SUGGEST_EDIT ⇒ proposedChanges NOT NULL.
--   6. @@index([type, status]) on Appeal.
--
-- NOTE: `prisma migrate diff` would also regenerate the usual drift
-- statements (DROP INDEX toilet_location_idx + ALTER Toilet.location
-- DROP NOT NULL) — both deliberately stripped. See KNOWN_ISSUES.md M2
-- + PROJECT_SPEC v1.1 §8. If you re-run `prisma migrate dev`, strip them
-- again before committing.

-- ============================================================
-- 1. AppealType enum swap
-- ============================================================

CREATE TYPE "AppealType_new" AS ENUM (
  'OWN_SUBMISSION_REJECT',
  'REPORT_DATA_ERROR',
  'SUGGEST_EDIT',
  'REPORT_CLOSED',
  'REPORT_NO_TOILET',
  'SELF_SOFT_DELETE'
);

-- Drop the old CHECK that pinned the target column before rebuilding.
-- (P1 added Appeal_target_required; we'll re-add after column changes.)
ALTER TABLE "Appeal" DROP CONSTRAINT IF EXISTS "Appeal_target_required";

-- Migrate the column to the new type. Any BAD_APPROVED_DATA row (none at
-- migration time, but the CASE is defensive) maps to REPORT_DATA_ERROR.
ALTER TABLE "Appeal"
  ALTER COLUMN "type" TYPE "AppealType_new"
  USING (
    CASE "type"::text
      WHEN 'BAD_APPROVED_DATA' THEN 'REPORT_DATA_ERROR'::"AppealType_new"
      ELSE "type"::text::"AppealType_new"
    END
  );

DROP TYPE "AppealType";
ALTER TYPE "AppealType_new" RENAME TO "AppealType";

-- ============================================================
-- 2. ToiletStatus additions (simple — no swap needed)
-- ============================================================

ALTER TYPE "ToiletStatus" ADD VALUE IF NOT EXISTS 'CLOSED';
ALTER TYPE "ToiletStatus" ADD VALUE IF NOT EXISTS 'NO_TOILET_HERE';

-- ============================================================
-- 3. Appeal new columns
-- ============================================================

ALTER TABLE "Appeal"
  ADD COLUMN "proposedChanges" JSONB,
  ADD COLUMN "aiDecision"      "ModerationDecision",
  ADD COLUMN "aiConfidence"    DOUBLE PRECISION,
  ADD COLUMN "aiReasons"       JSONB,
  ADD COLUMN "aiRawText"       TEXT,
  ADD COLUMN "aiModeratedAt"   TIMESTAMP(3);

-- ============================================================
-- 4. Toilet community-edit audit columns
-- ============================================================

ALTER TABLE "Toilet"
  ADD COLUMN "lastCommunityEditAt" TIMESTAMP(3),
  ADD COLUMN "lastCommunityEditBy" TEXT,
  ADD COLUMN "originalOsmTags"     JSONB;

ALTER TABLE "Toilet"
  ADD CONSTRAINT "Toilet_lastCommunityEditBy_fkey"
  FOREIGN KEY ("lastCommunityEditBy") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 5. CHECK constraints
-- ============================================================

-- Every AppealType targets a Toilet row. (P1 had this, re-add after
-- the enum swap replaced the parent type.)
ALTER TABLE "Appeal"
  ADD CONSTRAINT "Appeal_target_required"
  CHECK ("targetToiletId" IS NOT NULL);

-- SUGGEST_EDIT mandates proposedChanges; other types mandate it be null
-- (symmetric, so the app layer can't leak stale payloads on non-edit
-- types). Using JSONB NULL is fine for non-edit types.
ALTER TABLE "Appeal"
  ADD CONSTRAINT "Appeal_suggest_edit_payload"
  CHECK (
    ("type" = 'SUGGEST_EDIT' AND "proposedChanges" IS NOT NULL)
    OR ("type" <> 'SUGGEST_EDIT' AND "proposedChanges" IS NULL)
  );

-- ============================================================
-- 6. New Appeal index
-- ============================================================

CREATE INDEX "Appeal_type_status_idx" ON "Appeal"("type", "status");
