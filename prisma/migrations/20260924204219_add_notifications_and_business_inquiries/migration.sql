-- AlterTable
ALTER TABLE "astore_order_items" ALTER COLUMN "imageUrls" DROP DEFAULT;

-- AlterTable
ALTER TABLE "astore_products" ALTER COLUMN "imageUrls" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "notifyOnLinkTap" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "business_inquiries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "companySize" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "business_inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_inquiries_userId_idx" ON "business_inquiries"("userId");

-- AddForeignKey
ALTER TABLE "business_inquiries" ADD CONSTRAINT "business_inquiries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
