-- AlterTable
ALTER TABLE "astore_products" ADD COLUMN "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "astore_order_items" ADD COLUMN "productName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "astore_order_items" ADD COLUMN "productSlug" TEXT NOT NULL DEFAULT '';
ALTER TABLE "astore_order_items" ADD COLUMN "productType" "ProductType";
ALTER TABLE "astore_order_items" ADD COLUMN "variantColorName" TEXT;
ALTER TABLE "astore_order_items" ADD COLUMN "variantColorHex" TEXT;
ALTER TABLE "astore_order_items" ADD COLUMN "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Backfill snapshots from live catalog for existing order lines
UPDATE "astore_order_items" AS oi
SET
  "productName" = p.name,
  "productSlug" = p.slug,
  "productType" = p.type,
  "variantColorName" = v."colorName",
  "variantColorHex" = v."colorHex",
  "imageUrls" = CASE
    WHEN v.id IS NOT NULL AND cardinality(v."imageUrls") > 0 THEN v."imageUrls"
    ELSE p."imageUrls"
  END
FROM "astore_order_items" source
JOIN "astore_products" p ON p.id = source."productId"
LEFT JOIN "astore_product_variants" v ON v.id = source."variantId"
WHERE oi.id = source.id
  AND oi."productName" = '';
