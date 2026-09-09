import { StatusCodes } from "http-status-codes";
import { prisma } from "@/shared/config/database";
import { ServiceResponse } from "@/shared/utils/serviceResponse";
import {
  MAX_CART_ITEM_QTY,
  STORE_CURRENCY,
} from "@/modules/astore/astore.commerce";
import { uploadToCloudinary } from "@/shared/utils/cloudinary";
import type { TAddCartItemBody, TUpdateCartItemBody } from "./cart.schemas";

const cartItemInclude = {
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      active: true,
      currency: true,
      basePriceKobo: true,
    },
  },
  variant: {
    select: {
      id: true,
      colorName: true,
      colorHex: true,
      imageUrls: true,
      stockQty: true,
      priceKobo: true,
      active: true,
    },
  },
} as const;

const shapeCart = (cart: {
  id: string;
  userId: string;
  updatedAt: Date;
  items: Array<{
    id: string;
    quantity: number;
    customUsername: string | null;
    preferredColor: string | null;
    instructions: string | null;
    artworkUrl: string | null;
    product: {
      id: string;
      name: string;
      slug: string;
      type: string;
      active: boolean;
      currency: string;
      basePriceKobo: number;
    };
    variant: {
      id: string;
      colorName: string;
      colorHex: string | null;
      imageUrls: string[];
      stockQty: number;
      priceKobo: number | null;
      active: boolean;
    } | null;
  }>;
}) => {
  const items = cart.items.map((item) => {
    const unitPriceKobo =
      item.variant?.priceKobo ?? item.product.basePriceKobo;
    return {
      id: item.id,
      quantity: item.quantity,
      customUsername: item.customUsername,
      preferredColor: item.preferredColor,
      instructions: item.instructions,
      artworkUrl: item.artworkUrl,
      unitPriceKobo,
      lineTotalKobo: unitPriceKobo * item.quantity,
      currency: item.product.currency,
      product: item.product,
      variant: item.variant,
    };
  });

  const subtotalKobo = items.reduce((sum, i) => sum + i.lineTotalKobo, 0);

  return {
    id: cart.id,
    userId: cart.userId,
    updatedAt: cart.updatedAt,
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    subtotalKobo,
    items,
  };
};

const getOrCreateCart = async (userId: string) => {
  const existing = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        orderBy: { createdAt: "asc" },
        include: cartItemInclude,
      },
    },
  });

  if (existing) return existing;

  return prisma.cart.create({
    data: { userId },
    include: {
      items: {
        orderBy: { createdAt: "asc" },
        include: cartItemInclude,
      },
    },
  });
};

/** GET /api/v1/cart */
export const getCart = async (userId: string) => {
  const cart = await getOrCreateCart(userId);
  return ServiceResponse.success("Cart retrieved successfully", shapeCart(cart));
};

/** POST /api/v1/cart/items — add or increment matching line */
export const addCartItem = async (userId: string, body: TAddCartItemBody) => {
  const product = await prisma.aStoreProduct.findFirst({
    where: { id: body.productId, active: true },
    select: { id: true, type: true, currency: true },
  });

  if (!product) {
    return ServiceResponse.failure(
      "Product not found or inactive",
      null,
      StatusCodes.NOT_FOUND
    );
  }

  if (product.currency !== STORE_CURRENCY) {
    return ServiceResponse.failure(
      `Only ${STORE_CURRENCY} products can be added to cart`,
      null,
      StatusCodes.CONFLICT
    );
  }

  const quantity = body.quantity ?? 1;

  // Standard: must pick a stocked variant. Custom: MTO — no variant / no stock.
  let variantId: string | null = null;

  if (product.type === "standard") {
    if (!body.variantId) {
      return ServiceResponse.failure(
        "A product option (variant) is required for this product",
        null,
        StatusCodes.BAD_REQUEST
      );
    }

    const variant = await prisma.aStoreProductVariant.findFirst({
      where: {
        id: body.variantId,
        productId: body.productId,
        active: true,
      },
      select: { id: true },
    });

    if (!variant) {
      return ServiceResponse.failure(
        "Variant not found or inactive",
        null,
        StatusCodes.NOT_FOUND
      );
    }
    variantId = variant.id;
  } else if (body.variantId) {
    return ServiceResponse.failure(
      "Custom products do not use stocked variants — use preferredColor instead",
      null,
      StatusCodes.BAD_REQUEST
    );
  }

  const customUsername = body.customUsername ?? null;
  const preferredColor = body.preferredColor ?? null;
  const instructions = body.instructions ?? null;
  const artworkUrl = body.artworkUrl ?? null;

  try {
    await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM carts WHERE "userId" = ${userId} FOR UPDATE
      `;

      let cartId = locked[0]?.id;
      if (!cartId) {
        const created = await tx.cart.create({ data: { userId } });
        cartId = created.id;
      }

      const existingItem = await tx.cartItem.findFirst({
        where: {
          cartId,
          productId: body.productId,
          variantId,
          customUsername,
          preferredColor,
          instructions,
          artworkUrl,
        },
      });

      if (existingItem) {
        const nextQty = existingItem.quantity + quantity;
        if (nextQty > MAX_CART_ITEM_QTY) {
          throw new Error("QTY_CAP");
        }
        await tx.cartItem.update({
          where: { id: existingItem.id },
          data: { quantity: nextQty },
        });
      } else {
        await tx.cartItem.create({
          data: {
            cartId,
            productId: body.productId,
            variantId,
            quantity,
            customUsername,
            preferredColor,
            instructions,
            artworkUrl,
          },
        });
      }
    });
  } catch (err) {
    if (err instanceof Error && err.message === "QTY_CAP") {
      return ServiceResponse.failure(
        `Quantity cannot exceed ${MAX_CART_ITEM_QTY} per line`,
        null,
        StatusCodes.CONFLICT
      );
    }
    throw err;
  }

  const updated = await getOrCreateCart(userId);
  return ServiceResponse.success(
    "Item added to cart",
    shapeCart(updated),
    StatusCodes.CREATED
  );
};

/** PATCH /api/v1/cart/items/:itemId */
export const updateCartItem = async (
  userId: string,
  itemId: string,
  body: TUpdateCartItemBody
) => {
  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) {
    return ServiceResponse.failure(
      "Cart not found",
      null,
      StatusCodes.NOT_FOUND
    );
  }

  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cartId: cart.id },
  });

  if (!item) {
    return ServiceResponse.failure(
      "Cart item not found",
      null,
      StatusCodes.NOT_FOUND
    );
  }

  await prisma.cartItem.update({
    where: { id: itemId },
    data: {
      ...(body.quantity !== undefined ? { quantity: body.quantity } : {}),
      ...(body.customUsername !== undefined
        ? { customUsername: body.customUsername }
        : {}),
      ...(body.preferredColor !== undefined
        ? { preferredColor: body.preferredColor }
        : {}),
      ...(body.instructions !== undefined
        ? { instructions: body.instructions }
        : {}),
      ...(body.artworkUrl !== undefined ? { artworkUrl: body.artworkUrl } : {}),
    },
  });

  const updated = await getOrCreateCart(userId);
  return ServiceResponse.success("Cart item updated", shapeCart(updated));
};

/** DELETE /api/v1/cart/items/:itemId */
export const removeCartItem = async (userId: string, itemId: string) => {
  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) {
    return ServiceResponse.failure(
      "Cart not found",
      null,
      StatusCodes.NOT_FOUND
    );
  }

  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cartId: cart.id },
  });

  if (!item) {
    return ServiceResponse.failure(
      "Cart item not found",
      null,
      StatusCodes.NOT_FOUND
    );
  }

  await prisma.cartItem.delete({ where: { id: itemId } });

  const updated = await getOrCreateCart(userId);
  return ServiceResponse.success("Cart item removed", shapeCart(updated));
};

/** DELETE /api/v1/cart — clear all items */
export const clearCart = async (userId: string) => {
  const cart = await getOrCreateCart(userId);
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  const updated = await getOrCreateCart(userId);
  return ServiceResponse.success("Cart cleared", shapeCart(updated));
};

/** POST /api/v1/cart/artwork — upload custom artwork → CDN URL for cart line */
export const uploadArtwork = async (
  _userId: string,
  fileBuffer: Buffer,
  mimetype?: string
) => {
  const { url, publicId } = await uploadToCloudinary(
    fileBuffer,
    "astore-artwork",
    mimetype
  );

  return ServiceResponse.success(
    "Artwork uploaded successfully",
    { url, publicId },
    StatusCodes.CREATED
  );
};
