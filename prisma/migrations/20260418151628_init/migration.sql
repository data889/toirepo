-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'TRUSTED_USER', 'MODERATOR', 'SENIOR_MODERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "ToiletStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'HIDDEN', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ToiletSource" AS ENUM ('OSM_IMPORT', 'USER_SUBMISSION', 'ADMIN_CREATED');

-- CreateEnum
CREATE TYPE "ToiletType" AS ENUM ('PUBLIC', 'MALL', 'KONBINI', 'PURCHASE');

-- CreateEnum
CREATE TYPE "StationGateSide" AS ENUM ('INSIDE', 'OUTSIDE', 'BOTH');

-- CreateEnum
CREATE TYPE "StallCount" AS ENUM ('SMALL', 'MEDIUM', 'LARGE');

-- CreateEnum
CREATE TYPE "PhotoCategory" AS ENUM ('ENTRANCE', 'SIGNAGE', 'EXTERIOR', 'BUILDING');

-- CreateEnum
CREATE TYPE "PhotoStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'NEEDS_INFO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'zh-CN',
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "trustLevel" INTEGER NOT NULL DEFAULT 0,
    "approvedSubmissions" INTEGER NOT NULL DEFAULT 0,
    "rejectedSubmissions" INTEGER NOT NULL DEFAULT 0,
    "bannedAt" TIMESTAMP(3),
    "banReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Toilet" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "location" geography(Point, 4326) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "type" "ToiletType" NOT NULL,
    "name" JSONB NOT NULL,
    "address" JSONB NOT NULL,
    "building" JSONB,
    "floor" TEXT,
    "stationGateSide" "StationGateSide",
    "isFree" BOOLEAN NOT NULL DEFAULT true,
    "requiresPurchase" BOOLEAN NOT NULL DEFAULT false,
    "requiresKey" BOOLEAN NOT NULL DEFAULT false,
    "is24Hours" BOOLEAN NOT NULL DEFAULT false,
    "hasAccessible" BOOLEAN NOT NULL DEFAULT false,
    "hasBabyChanging" BOOLEAN NOT NULL DEFAULT false,
    "hasKidsToilet" BOOLEAN NOT NULL DEFAULT false,
    "hasWashlet" BOOLEAN NOT NULL DEFAULT false,
    "hasGenderNeutral" BOOLEAN NOT NULL DEFAULT false,
    "hasFamilyRoom" BOOLEAN NOT NULL DEFAULT false,
    "stallCount" "StallCount",
    "openingHours" JSONB,
    "accessNote" JSONB,
    "source" "ToiletSource" NOT NULL DEFAULT 'USER_SUBMISSION',
    "osmId" TEXT,
    "submittedById" TEXT,
    "status" "ToiletStatus" NOT NULL DEFAULT 'PENDING',
    "publishedAt" TIMESTAMP(3),
    "cleanliness" DOUBLE PRECISION,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "photoCount" INTEGER NOT NULL DEFAULT 0,
    "lastConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Toilet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "toiletId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "category" "PhotoCategory" NOT NULL DEFAULT 'ENTRANCE',
    "status" "PhotoStatus" NOT NULL DEFAULT 'PENDING',
    "aiPrescreenResult" JSONB,
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "toiletId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cleanliness" INTEGER NOT NULL,
    "comment" JSONB,
    "originalLocale" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Confirmation" (
    "id" TEXT NOT NULL,
    "toiletId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stillAvailable" BOOLEAN NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Confirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnerDispute" (
    "id" TEXT NOT NULL,
    "toiletId" TEXT NOT NULL,
    "claimerEmail" TEXT NOT NULL,
    "claimerName" TEXT NOT NULL,
    "claimerRole" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidenceUrls" TEXT[],
    "status" "DisputeStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedAt" TIMESTAMP(3),
    "resolvedNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnerDispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "toiletId" TEXT,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Toilet_slug_key" ON "Toilet"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Toilet_osmId_key" ON "Toilet"("osmId");

-- CreateIndex
CREATE INDEX "Toilet_type_status_idx" ON "Toilet"("type", "status");

-- CreateIndex
CREATE INDEX "Toilet_status_publishedAt_idx" ON "Toilet"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "Toilet_osmId_idx" ON "Toilet"("osmId");

-- CreateIndex
CREATE INDEX "Photo_toiletId_status_idx" ON "Photo"("toiletId", "status");

-- CreateIndex
CREATE INDEX "Review_toiletId_status_idx" ON "Review"("toiletId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Review_toiletId_userId_key" ON "Review"("toiletId", "userId");

-- CreateIndex
CREATE INDEX "Confirmation_toiletId_idx" ON "Confirmation"("toiletId");

-- CreateIndex
CREATE INDEX "Confirmation_userId_createdAt_idx" ON "Confirmation"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_toiletId_idx" ON "AuditLog"("toiletId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Toilet" ADD CONSTRAINT "Toilet_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_toiletId_fkey" FOREIGN KEY ("toiletId") REFERENCES "Toilet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_toiletId_fkey" FOREIGN KEY ("toiletId") REFERENCES "Toilet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Confirmation" ADD CONSTRAINT "Confirmation_toiletId_fkey" FOREIGN KEY ("toiletId") REFERENCES "Toilet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Confirmation" ADD CONSTRAINT "Confirmation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerDispute" ADD CONSTRAINT "OwnerDispute_toiletId_fkey" FOREIGN KEY ("toiletId") REFERENCES "Toilet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_toiletId_fkey" FOREIGN KEY ("toiletId") REFERENCES "Toilet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
