-- CreateTable
CREATE TABLE "gift_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "claimTokenHash" TEXT,
    "claimTokenExpiresAt" TIMESTAMPTZ(6),
    "claimedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "gift_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gift_accounts_userId_key" ON "gift_accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "gift_accounts_claimTokenHash_key" ON "gift_accounts"("claimTokenHash");

-- CreateIndex
CREATE INDEX "gift_accounts_createdById_idx" ON "gift_accounts"("createdById");

-- CreateIndex
CREATE INDEX "gift_accounts_claimedAt_idx" ON "gift_accounts"("claimedAt");

-- AddForeignKey
ALTER TABLE "gift_accounts" ADD CONSTRAINT "gift_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_accounts" ADD CONSTRAINT "gift_accounts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
