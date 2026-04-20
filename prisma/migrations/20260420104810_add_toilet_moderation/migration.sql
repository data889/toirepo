-- CreateEnum
CREATE TYPE "ModerationDecision" AS ENUM ('APPROVED', 'REJECTED', 'NEEDS_HUMAN');

-- NOTE: `prisma migrate dev` generated two extra statements here that were
-- stripped by hand before committing:
--   DROP INDEX "toilet_location_idx";
--   ALTER TABLE "Toilet" ALTER COLUMN "location" DROP NOT NULL;
-- Both are drift artefacts from Prisma typing Toilet.location as
-- `Unsupported?` while the column is NOT NULL at the DB layer with a
-- BEFORE INSERT trigger populating it from lat/lng. See KNOWN_ISSUES.md
-- M2 and PROJECT_SPEC v1.1 §8. If you re-run migrate dev, strip them
-- again before committing.

-- CreateTable
CREATE TABLE "ToiletModeration" (
    "id" TEXT NOT NULL,
    "toiletId" TEXT NOT NULL,
    "decision" "ModerationDecision" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reasons" JSONB NOT NULL,
    "issues" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "rawText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToiletModeration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ToiletModeration_toiletId_key" ON "ToiletModeration"("toiletId");

-- CreateIndex
CREATE INDEX "ToiletModeration_decision_idx" ON "ToiletModeration"("decision");

-- CreateIndex
CREATE INDEX "ToiletModeration_confidence_idx" ON "ToiletModeration"("confidence");

-- CreateIndex
CREATE INDEX "ToiletModeration_createdAt_idx" ON "ToiletModeration"("createdAt");

-- AddForeignKey
ALTER TABLE "ToiletModeration" ADD CONSTRAINT "ToiletModeration_toiletId_fkey" FOREIGN KEY ("toiletId") REFERENCES "Toilet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
