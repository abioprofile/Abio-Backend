-- CreateEnum
CREATE TYPE "DeliveryZone" AS ENUM ('lagos', 'outside_lagos');

-- AlterTable
ALTER TABLE "astore_orders" ADD COLUMN "subtotalKobo" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "astore_orders" ADD COLUMN "shippingFeeKobo" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "astore_orders" ADD COLUMN "deliveryZone" "DeliveryZone";

-- Backfill subtotal from total for existing rows (pre-fee orders)
UPDATE "astore_orders" SET "subtotalKobo" = "totalAmountKobo" WHERE "subtotalKobo" = 0;
