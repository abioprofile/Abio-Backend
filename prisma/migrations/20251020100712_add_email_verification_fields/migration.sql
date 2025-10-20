-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailVerificationExpires" TIMESTAMPTZ(6),
ADD COLUMN     "emailVerificationToken" TEXT;
