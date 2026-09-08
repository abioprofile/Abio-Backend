import { StatusCodes } from "http-status-codes";
import { prisma } from "@/shared/config/database";
import { ServiceResponse } from "@/shared/utils/serviceResponse";
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
    select: { id: true, type: true },
  });

  if (!product) {
    return ServiceResponse.failure(
      "Product not found or inactive",
      null,
      StatusCodes.NOT_FOUND
    );
  }

  if (body.variantId) {
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
  }

  const cart = await getOrCreateCart(userId);
  const quantity = body.quantity ?? 1;

  // Merge when same product + variant (+ custom username for custom lines)
  const existingItem = await prisma.cartItem.findFirst({
    where: {
      cartId: cart.id,
      productId: body.productId,
      variantId: body.variantId ?? null,
      customUsername: body.customUsername ?? null,
    },
  });

  if (existingItem) {
    await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: {
        quantity: existingItem.quantity + quantity,
        ...(body.preferredColor !== undefined
          ? { preferredColor: body.preferredColor }
          : {}),
        ...(body.instructions !== undefined
          ? { instructions: body.instructions }
          : {}),
        ...(body.artworkUrl !== undefined
          ? { artworkUrl: body.artworkUrl }
          : {}),
      },
    });
  } else {
    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: body.productId,
        variantId: body.variantId ?? null,
        quantity,
        customUsername: body.customUsername,
        preferredColor: body.preferredColor,
        instructions: body.instructions,
        artworkUrl: body.artworkUrl,
      },
    });
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
