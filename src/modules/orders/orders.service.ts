import { StatusCodes } from "http-status-codes";
import { prisma } from "@/shared/config/database";
import {
  getPagination,
  getTotalPages,
} from "@/shared/utils/pagination";
import { ServiceResponse } from "@/shared/utils/serviceResponse";
import type { TCheckoutBody, TListOrdersQuery } from "./orders.schemas";

const orderInclude = {
  items: {
    orderBy: { createdAt: "asc" as const },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
        },
      },
      variant: {
        select: {
          id: true,
          colorName: true,
          colorHex: true,
          imageUrls: true,
        },
      },
    },
  },
  payment: {
    select: {
      id: true,
      status: true,
      provider: true,
      amountKobo: true,
      currency: true,
      paidAt: true,
      createdAt: true,
    },
  },
} as const;

/** POST /api/v1/orders/checkout — cart → order + pending payment */
export const checkout = async (userId: string, body: TCheckoutBody) => {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: {
          product: true,
          variant: true,
        },
      },
    },
  });

  if (!cart || cart.items.length === 0) {
    return ServiceResponse.failure(
      "Cart is empty",
      null,
      StatusCodes.BAD_REQUEST
    );
  }

  // Validate lines before opening the write transaction
  for (const item of cart.items) {
    if (!item.product.active) {
      return ServiceResponse.failure(
        `Product "${item.product.name}" is no longer available`,
        null,
        StatusCodes.CONFLICT
      );
    }

    if (item.variantId) {
      if (!item.variant || !item.variant.active) {
        return ServiceResponse.failure(
          `A selected option for "${item.product.name}" is unavailable`,
          null,
          StatusCodes.CONFLICT
        );
      }
      if (item.variant.stockQty < item.quantity) {
        return ServiceResponse.failure(
          `Not enough stock for "${item.product.name}" (${item.variant.colorName})`,
          null,
          StatusCodes.CONFLICT
        );
      }
    }
  }

  try {
    const order = await prisma.$transaction(async (tx) => {
      const currency = cart.items[0]?.product.currency ?? "NGN";
      let totalAmountKobo = 0;

      const lineData = cart.items.map((item) => {
        const unitPriceKobo =
          item.variant?.priceKobo ?? item.product.basePriceKobo;
        totalAmountKobo += unitPriceKobo * item.quantity;
        return {
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPriceKobo,
          customUsername: item.customUsername,
          preferredColor: item.preferredColor,
          instructions: item.instructions,
          artworkUrl: item.artworkUrl,
        };
      });

      // Reserve stock (atomic where possible)
      for (const item of cart.items) {
        if (!item.variantId) continue;

        const reserved = await tx.aStoreProductVariant.updateMany({
          where: {
            id: item.variantId,
            active: true,
            stockQty: { gte: item.quantity },
          },
          data: { stockQty: { decrement: item.quantity } },
        });

        if (reserved.count !== 1) {
          throw new Error(`STOCK:${item.product.name}`);
        }
      }

      const created = await tx.aStoreOrder.create({
        data: {
          userId,
          status: "processing",
          totalAmountKobo,
          currency,
          shippingAddress: body.shippingAddress,
          items: { create: lineData },
          payment: {
            create: {
              userId,
              amountKobo: totalAmountKobo,
              currency,
              provider: "bach",
              status: "pending",
            },
          },
        },
        include: orderInclude,
      });

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return created;
    });

    return ServiceResponse.success(
      "Order placed successfully",
      order,
      StatusCodes.CREATED
    );
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("STOCK:")) {
      const name = err.message.slice("STOCK:".length);
      return ServiceResponse.failure(
        `Not enough stock for "${name}"`,
        null,
        StatusCodes.CONFLICT
      );
    }
    throw err;
  }
};

/** GET /api/v1/orders — current user's orders */
export const listMyOrders = async (
  userId: string,
  query: TListOrdersQuery
) => {
  const { page, limit, skip } = getPagination(query as Record<string, unknown>);

  const where = { userId };

  const [total, orders] = await Promise.all([
    prisma.aStoreOrder.count({ where }),
    prisma.aStoreOrder.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: orderInclude,
    }),
  ]);

  return ServiceResponse.success("Orders retrieved successfully", {
    orders,
    pagination: {
      page,
      limit,
      total,
      totalPages: getTotalPages(total, limit),
    },
  });
};

/** GET /api/v1/orders/:id */
export const getMyOrderById = async (userId: string, orderId: string) => {
  const order = await prisma.aStoreOrder.findFirst({
    where: { id: orderId, userId },
    include: orderInclude,
  });

  if (!order) {
    return ServiceResponse.failure(
      "Order not found",
      null,
      StatusCodes.NOT_FOUND
    );
  }

  return ServiceResponse.success("Order retrieved successfully", order);
};
