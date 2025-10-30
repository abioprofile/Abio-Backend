-- AlterTable: Add name column (nullable temporarily)
ALTER TABLE "users" ADD COLUMN "name" TEXT;

-- Migrate existing data: Combine firstName and lastName into name
UPDATE "users" SET "name" = CONCAT("firstName", ' ', "lastName");

-- Make name column required
ALTER TABLE "users" ALTER COLUMN "name" SET NOT NULL;

-- Drop old columns
ALTER TABLE "users" DROP COLUMN "firstName";
ALTER TABLE "users" DROP COLUMN "lastName";

