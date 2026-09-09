-- CreateEnum
CREATE TYPE "BadgeRequestStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "badge_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeType" TEXT NOT NULL DEFAULT 'verified',
    "status" "BadgeRequestStatus" NOT NULL DEFAULT 'pending',
    "reason" TEXT NOT NULL,
    "idDocumentUrl" TEXT NOT NULL,
    "reviewedAt" TIMESTAMPTZ(6),
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "badge_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "badge_requests_userId_idx" ON "badge_requests"("userId");

-- CreateIndex
CREATE INDEX "badge_requests_status_idx" ON "badge_requests"("status");

-- CreateIndex
CREATE INDEX "badge_requests_userId_status_idx" ON "badge_requests"("userId", "status");

-- AddForeignKey
ALTER TABLE "badge_requests" ADD CONSTRAINT "badge_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "badge_requests" ADD CONSTRAINT "badge_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
