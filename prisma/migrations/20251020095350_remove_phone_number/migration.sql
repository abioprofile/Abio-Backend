/*
  Warnings:

  - You are about to drop the column `phoneNumber` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."users" DROP COLUMN "phoneNumber",
ADD COLUMN     "isEmailVerified" BOOLEAN NOT NULL DEFAULT false;
