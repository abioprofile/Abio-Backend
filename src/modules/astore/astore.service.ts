import type { Prisma } from "@prisma/client";
import { StatusCodes } from "http-status-codes";
import { prisma } from "@/shared/config/database";
import {
  getPagination,
  getTotalPages,
} from "@/shared/utils/pagination";
import { ServiceResponse } from "@/shared/utils/serviceResponse";
import type {
  TCreateProductBody,
  TCreateVariantBody,
  TListProductsQuery,
  TUpdateProductBody,
  TUpdateVariantBody,
} from "./astore.schemas";
import type { TListPublicProductsQuery } from "./astore.public.schemas";
import { STORE_CURRENCY } from "./astore.commerce";
import { uploadToCloudinary } from "@/shared/utils/cloudinary";

const productSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  active: true,
  type: true,
  currency: true,
  basePriceKobo: true,
  imageUrls: true,
  createdAt: true,
  updatedAt: true,
  variants: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      colorName: true,
      colorHex: true,
      imageUrls: true,
      stockQty: true,
      priceKobo: true,
      active: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.AStoreProductSelect;

// turns human name to kebab-case
const slugify = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140) || "product";

// Because two “Abio Tee”s can’t both be abio-tee
const uniqueSlug = async (
  base: string,
  excludeProductId?: string
) => {
  let slug = base;
  let n = 2;
  while (true) {
    const existing = await prisma.aStoreProduct.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing || existing.id === excludeProductId) return slug;
    slug = `${base}-${n}`.slice(0, 140);
    n += 1;
  }
};

/** GET /api/v1/admin/astore/products */
export const listProducts = async (query: TListProductsQuery) => {
  const { page, limit, skip } = getPagination(query as Record<string, unknown>);
  const where: Prisma.AStoreProductWhereInput = {};

  if (query.active !== undefined) {
    where.active = query.active === "true";
  }

  if (query.q) {
    where.OR = [
      { name: { contains: query.q, mode: "insensitive" } },
      { slug: { contains: query.q, mode: "insensitive" } },
    ];
  }

  const [total, products] = await Promise.all([
    prisma.aStoreProduct.count({ where }),
    prisma.aStoreProduct.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: productSelect,
    }),
  ]);

  return ServiceResponse.success("Products retrieved successfully", {
    products,
    pagination: {
      page,
      limit,
      total,
      totalPages: getTotalPages(total, limit),
    },
  });
};

/** GET /api/v1/admin/astore/products/:id */
export const getProductById = async (id: string) => {
  const product = await prisma.aStoreProduct.findUnique({
    where: { id },
    select: productSelect,
  });

  if (!product) {
    return ServiceResponse.failure(
      "Product not found",
      null,
      StatusCodes.NOT_FOUND
    );
  }

  return ServiceResponse.success("Product retrieved successfully", product);
};

/** POST /api/v1/admin/astore/products */
export const createProduct = async (
  body: TCreateProductBody,
  actorId: string
) => {
  const baseSlug = body.slug ?? slugify(body.name);
  const slug = await uniqueSlug(baseSlug);

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.aStoreProduct.create({
      data: {
        name: body.name,
        slug,
        description: body.description,
        type: body.type,
        currency: STORE_CURRENCY,
        basePriceKobo: body.basePriceKobo,
        imageUrls: body.imageUrls ?? [],
        active: body.active ?? true,
      },
      select: productSelect,
    });

    await tx.adminAuditLog.create({
      data: {
        adminId: actorId,
        action: "astore.product.create",
        resourceType: "astore_product",
        resourceId: created.id,
        newValue: {
          name: created.name,
          slug: created.slug,
          type: created.type,
          basePriceKobo: created.basePriceKobo,
        },
      },
    });

    return created;
  });

  return ServiceResponse.success(
    "Product created successfully",
    product,
    StatusCodes.CREATED
  );
};

/** PATCH /api/v1/admin/astore/products/:id */
export const updateProduct = async (
  id: string,
  body: TUpdateProductBody,
  actorId: string
) => {
  const existing = await prisma.aStoreProduct.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      active: true,
      basePriceKobo: true,
      type: true,
      imageUrls: true,
    },
  });

  if (!existing) {
    return ServiceResponse.failure(
      "Product not found",
      null,
      StatusCodes.NOT_FOUND
    );
  }

  let nextSlug: string | undefined;
  if (body.slug !== undefined) {
    nextSlug = await uniqueSlug(body.slug, id);
  }

  const product = await prisma.$transaction(async (tx) => {
    const updated = await tx.aStoreProduct.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(nextSlug !== undefined ? { slug: nextSlug } : {}),
        ...(body.description !== undefined
          ? { description: body.description }
          : {}),
        ...(body.type !== undefined ? { type: body.type } : {}),
        ...(body.currency !== undefined ? { currency: STORE_CURRENCY } : {}),
        ...(body.basePriceKobo !== undefined
          ? { basePriceKobo: body.basePriceKobo }
          : {}),
        ...(body.imageUrls !== undefined ? { imageUrls: body.imageUrls } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
      },
      select: productSelect,
    });

    await tx.adminAuditLog.create({
      data: {
        adminId: actorId,
        action: "astore.product.update",
        resourceType: "astore_product",
        resourceId: id,
        oldValue: existing,
        newValue: body,
      },
    });

    return updated;
  });

  return ServiceResponse.success("Product updated successfully", product);
};

/** POST /api/v1/admin/astore/products/:id/images — multipart append to gallery */
export const uploadProductImage = async (
  productId: string,
  fileBuffer: Buffer,
  actorId: string,
  mimetype?: string
) => {
  const existing = await prisma.aStoreProduct.findUnique({
    where: { id: productId },
    select: { id: true, imageUrls: true },
  });

  if (!existing) {
    return ServiceResponse.failure(
      "Product not found",
      null,
      StatusCodes.NOT_FOUND
    );
  }

  if (existing.imageUrls.length >= 10) {
    return ServiceResponse.failure(
      "Product already has the maximum of 10 images",
      null,
      StatusCodes.CONFLICT
    );
  }

  const { url, publicId } = await uploadToCloudinary(
    fileBuffer,
    "astore-products",
    mimetype
  );

  const product = await prisma.$transaction(async (tx) => {
    const updated = await tx.aStoreProduct.update({
      where: { id: productId },
      data: { imageUrls: { push: url } },
      select: productSelect,
    });

    await tx.adminAuditLog.create({
      data: {
        adminId: actorId,
        action: "astore.product.image.upload",
        resourceType: "astore_product",
        resourceId: productId,
        newValue: { url, publicId },
      },
    });

    return updated;
  });

  return ServiceResponse.success(
    "Product image uploaded successfully",
    { url, publicId, product },
    StatusCodes.CREATED
  );
};

/** POST /api/v1/admin/astore/products/:id/variants */
export const createVariant = async (
  productId: string,
  body: TCreateVariantBody,
  actorId: string
) => {
  const product = await prisma.aStoreProduct.findUnique({
    where: { id: productId },
    select: { id: true },
  });

  if (!product) {
    return ServiceResponse.failure(
      "Product not found",
      null,
      StatusCodes.NOT_FOUND
    );
  }

  try {
    const variant = await prisma.$transaction(async (tx) => {
      const created = await tx.aStoreProductVariant.create({
        data: {
          productId,
          colorName: body.colorName,
          colorHex: body.colorHex,
          imageUrls: body.imageUrls ?? [],
          stockQty: body.stockQty ?? 0,
          priceKobo: body.priceKobo ?? null,
          active: body.active ?? true,
        },
      });

      await tx.adminAuditLog.create({
        data: {
          adminId: actorId,
          action: "astore.variant.create",
          resourceType: "astore_product_variant",
          resourceId: created.id,
          newValue: {
            productId,
            colorName: created.colorName,
            stockQty: created.stockQty,
            priceKobo: created.priceKobo,
          },
        },
      });

      return created;
    });

    return ServiceResponse.success(
      "Variant created successfully",
      variant,
      StatusCodes.CREATED
    );
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return ServiceResponse.failure(
        "A variant with this color already exists on the product",
        null,
        StatusCodes.CONFLICT
      );
    }
    throw err;
  }
};

/** PATCH /api/v1/admin/astore/products/:id/variants/:variantId */
export const updateVariant = async (
  productId: string,
  variantId: string,
  body: TUpdateVariantBody,
  actorId: string
) => {
  const existing = await prisma.aStoreProductVariant.findFirst({
    where: { id: variantId, productId },
  });

  if (!existing) {
    return ServiceResponse.failure(
      "Variant not found",
      null,
      StatusCodes.NOT_FOUND
    );
  }

  try {
    const variant = await prisma.$transaction(async (tx) => {
      const updated = await tx.aStoreProductVariant.update({
        where: { id: variantId },
        data: {
          ...(body.colorName !== undefined
            ? { colorName: body.colorName }
            : {}),
          ...(body.colorHex !== undefined ? { colorHex: body.colorHex } : {}),
          ...(body.imageUrls !== undefined
            ? { imageUrls: body.imageUrls }
            : {}),
          ...(body.stockQty !== undefined ? { stockQty: body.stockQty } : {}),
          ...(body.priceKobo !== undefined
            ? { priceKobo: body.priceKobo }
            : {}),
          ...(body.active !== undefined ? { active: body.active } : {}),
        },
      });

      await tx.adminAuditLog.create({
        data: {
          adminId: actorId,
          action: "astore.variant.update",
          resourceType: "astore_product_variant",
          resourceId: variantId,
          oldValue: {
            colorName: existing.colorName,
            stockQty: existing.stockQty,
            active: existing.active,
            priceKobo: existing.priceKobo,
          },
          newValue: body,
        },
      });

      return updated;
    });

    return ServiceResponse.success("Variant updated successfully", variant);
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return ServiceResponse.failure(
        "A variant with this color already exists on the product",
        null,
        StatusCodes.CONFLICT
      );
    }
    throw err;
  }
};

/** Public catalog — only active products + active variants */
const publicProductSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  type: true,
  currency: true,
  basePriceKobo: true,
  imageUrls: true,
  createdAt: true,
  variants: {
    where: { active: true },
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      colorName: true,
      colorHex: true,
      imageUrls: true,
      stockQty: true,
      priceKobo: true,
    },
  },
} satisfies Prisma.AStoreProductSelect;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** GET /api/v1/astore/products */
export const listPublicProducts = async (query: TListPublicProductsQuery) => {
  const { page, limit, skip } = getPagination(query as Record<string, unknown>);

  const where: Prisma.AStoreProductWhereInput = {
    active: true,
  };

  if (query.type) {
    where.type = query.type;
  }

  if (query.q) {
    where.OR = [
      { name: { contains: query.q, mode: "insensitive" } },
      { slug: { contains: query.q, mode: "insensitive" } },
      { description: { contains: query.q, mode: "insensitive" } },
    ];
  }

  const [total, products] = await Promise.all([
    prisma.aStoreProduct.count({ where }),
    prisma.aStoreProduct.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: publicProductSelect,
    }),
  ]);

  return ServiceResponse.success("Products retrieved successfully", {
    products,
    pagination: {
      page,
      limit,
      total,
      totalPages: getTotalPages(total, limit),
    },
  });
};

/** GET /api/v1/astore/products/:idOrSlug */
export const getPublicProduct = async (idOrSlug: string) => {
  const where: Prisma.AStoreProductWhereInput = {
    active: true,
    ...(UUID_RE.test(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug }),
  };

  const product = await prisma.aStoreProduct.findFirst({
    where,
    select: publicProductSelect,
  });

  if (!product) {
    return ServiceResponse.failure(
      "Product not found",
      null,
      StatusCodes.NOT_FOUND
    );
  }

  return ServiceResponse.success("Product retrieved successfully", product);
};
