-- Add required name column to waitlists
-- Use a default temporarily to satisfy NOT NULL, then drop the default

ALTER TABLE "waitlists"
ADD COLUMN "name" TEXT NOT NULL DEFAULT '';

-- Optional: backfill from email local-part if empty
UPDATE "waitlists"
SET "name" = COALESCE(NULLIF("name", ''), split_part("email", '@', 1));

-- Drop default so future inserts must provide name explicitly
ALTER TABLE "waitlists"
ALTER COLUMN "name" DROP DEFAULT;


