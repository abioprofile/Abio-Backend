-- AlterTable
ALTER TABLE "links" ADD COLUMN     "icon_link" TEXT;

-- AlterTable
ALTER TABLE "waitlists" ALTER COLUMN "name" SET DEFAULT 'Anonymous';
