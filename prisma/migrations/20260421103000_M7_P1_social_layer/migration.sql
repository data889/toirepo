-- M7 P1 · Social layer schema.
--
-- NOTE: `prisma migrate diff` appended two drift statements here that
-- were stripped by hand before committing:
--   DROP INDEX "toilet_location_idx";
--   ALTER TABLE "Toilet" ALTER COLUMN "location" DROP NOT NULL;
-- Both are known drift artefacts from Prisma typing Toilet.location as
-- `Unsupported?` while the column is NOT NULL at the DB layer with a
-- BEFORE INSERT trigger populating it from lat/lng. See KNOWN_ISSUES.md
-- M2 and PROJECT_SPEC v1.1 §8. If you re-run migrate, strip them again
-- before committing.

-- CreateEnum
CREATE TYPE "AppealType" AS ENUM ('OWN_SUBMISSION_REJECT', 'BAD_APPROVED_DATA');

-- CreateEnum
CREATE TYPE "AppealStatus" AS ENUM ('PENDING', 'UPHELD', 'DISMISSED');

-- AlterEnum
ALTER TYPE "ReviewStatus" ADD VALUE 'HIDDEN';

-- AlterTable
ALTER TABLE "Confirmation" DROP COLUMN "note",
DROP COLUMN "stillAvailable";

-- AlterTable (Review reshape — tables empty, DROPs are safe)
ALTER TABLE "Review" DROP COLUMN "cleanliness",
DROP COLUMN "comment",
DROP COLUMN "originalLocale",
DROP COLUMN "rejectedReason",
ADD COLUMN     "aiConfidence" DOUBLE PRECISION,
ADD COLUMN     "aiDecision" "ModerationDecision",
ADD COLUMN     "aiModeratedAt" TIMESTAMP(3),
ADD COLUMN     "aiRawText" TEXT,
ADD COLUMN     "aiReasons" JSONB,
ADD COLUMN     "body" TEXT,
ADD COLUMN     "photoKeys" TEXT[],
ADD COLUMN     "rating" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "autoTrustChecked" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Appeal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AppealType" NOT NULL,
    "targetToiletId" TEXT,
    "reason" TEXT NOT NULL,
    "evidence" TEXT[],
    "status" "AppealStatus" NOT NULL DEFAULT 'PENDING',
    "resolutionNote" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appeal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Appeal_status_createdAt_idx" ON "Appeal"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Appeal_userId_idx" ON "Appeal"("userId");

-- CreateIndex
CREATE INDEX "Appeal_targetToiletId_idx" ON "Appeal"("targetToiletId");

-- CreateIndex
CREATE UNIQUE INDEX "Confirmation_toiletId_userId_key" ON "Confirmation"("toiletId", "userId");

-- CreateIndex
CREATE INDEX "Review_status_createdAt_idx" ON "Review"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_targetToiletId_fkey" FOREIGN KEY ("targetToiletId") REFERENCES "Toilet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Appeal target guard: both current AppealType values target a Toilet row
-- (OWN_SUBMISSION_REJECT's target is a REJECTED Toilet, which still lives in
-- the Toilet table). We keep targetToiletId nullable in the schema to stay
-- flexible for future target types (e.g. report a malicious user profile),
-- but for M7 P1 every row must have it set — enforced here.
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_target_required" CHECK (
  "targetToiletId" IS NOT NULL
);

-- Review.rating range guard: enforce 1..5 at DB level so any direct
-- INSERTs (tests, future admin console) can't land out-of-range values.
ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_range" CHECK (
  "rating" >= 1 AND "rating" <= 5
);
