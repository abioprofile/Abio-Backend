import { StatusCodes } from "http-status-codes";
import env from "@/env";
import { prisma } from "@/shared/config/database";
import {
  getPagination,
  getTotalPages,
} from "@/shared/utils/pagination";
import { ServiceResponse } from "@/shared/utils/serviceResponse";
import { createBachsCheckoutSession } from "@/modules/payments/bachs.client";
import {
  deliveryFeeKobo,
  STORE_CURRENCY,
} from "@/modules/astore/astore.commerce";
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
      providerRef: true,
      amountKobo: true,
      currency: true,
      paidAt: true,
      createdAt: true,
    },
  },
} as const;

const cartWithItemsInclude = {
  items: {
    include: {
      product: true,
      variant: true,
    },
  },
} as const;

const attachBachsCheckout = async (order: {
  id: string;
  totalAmountKobo: number;
  currency: string;
  payment: { id: string; providerRef: string | null } | null;
  user: { email: string; name: string };
}) => {
  if (!order.payment) {
    throw new Error("Order has no payment row");
  }

  const returnBase = env.BACHS_RETURN_BASE_URL || env.CLIENT_URL;

  const session = await createBachsCheckoutSession({
    amountKobo: order.totalAmountKobo,
    currency: order.currency,
    customerEmail: order.user.email,
    customerName: order.user.name,
    orderId: order.id,
    paymentId: order.payment.id,
    successUrl: `${returnBase}/orders/${order.id}?paid=1`,
    cancelUrl: `${returnBase}/orders/${order.id}?cancelled=1`,
  });

  await prisma.payment.update({
    where: { id: order.payment.id },
    data: { providerRef: session.checkoutId },
  });

  return session;
};

/** POST /api/v1/orders/checkout — cart → order + pending payment + Bachs URL */
export const checkout = async (userId: string, body: TCheckoutBody) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });

  if (!user) {
    return ServiceResponse.failure(
      "User not found",
      null,
      StatusCodes.NOT_FOUND
    );
  }

  const shippingFeeKobo = deliveryFeeKobo(body.deliveryZone);

  try {
    const order = await prisma.$transaction(async (tx) => {
      // Serialize concurrent checkouts for this user via cart row lock
      const lockedCart = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM carts WHERE "userId" = ${userId} FOR UPDATE
      `;

      if (!lockedCart[0]) {
        throw new Error("EMPTY_CART");
      }

      const cart = await tx.cart.findUnique({
        where: { id: lockedCart[0].id },
        include: cartWithItemsInclude,
      });

      if (!cart || cart.items.length === 0) {
        throw new Error("EMPTY_CART");
      }

      for (const item of cart.items) {
        if (!item.product.active) {
          throw new Error(`UNAVAILABLE:${item.product.name}`);
        }

        if (item.product.currency !== STORE_CURRENCY) {
          throw new Error("CURRENCY");
        }

        if (item.product.type === "standard") {
          if (!item.variantId || !item.variant || !item.variant.active) {
            throw new Error(`OPTION:${item.product.name}`);
          }
          if (item.variant.stockQty < item.quantity) {
            throw new Error(`STOCK:${item.product.name}`);
          }
        }
        // custom = made-to-order: no stock reservation
      }

      let subtotalKobo = 0;

      const lineData = cart.items.map((item) => {
        const unitPriceKobo =
          item.product.type === "standard"
            ? (item.variant?.priceKobo ?? item.product.basePriceKobo)
            : item.product.basePriceKobo;
        subtotalKobo += unitPriceKobo * item.quantity;

        const variantImages = item.variant?.imageUrls ?? [];
        const productImages = item.product.imageUrls ?? [];
        const imageUrls =
          variantImages.length > 0 ? variantImages : productImages;

        return {
          productId: item.productId,
          variantId:
            item.product.type === "standard" ? item.variantId : null,
          quantity: item.quantity,
          unitPriceKobo,
          productName: item.product.name,
          productSlug: item.product.slug,
          productType: item.product.type,
          variantColorName: item.variant?.colorName ?? null,
          variantColorHex: item.variant?.colorHex ?? null,
          imageUrls,
          customUsername: item.customUsername,
          preferredColor: item.preferredColor,
          instructions: item.instructions,
          artworkUrl: item.artworkUrl,
        };
      });

      const totalAmountKobo = subtotalKobo + shippingFeeKobo;

      for (const item of cart.items) {
        if (item.product.type !== "standard" || !item.variantId) continue;

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
          subtotalKobo,
          shippingFeeKobo,
          totalAmountKobo,
          deliveryZone: body.deliveryZone,
          currency: STORE_CURRENCY,
          shippingAddress: body.shippingAddress,
          items: { create: lineData },
          payment: {
            create: {
              userId,
              amountKobo: totalAmountKobo,
              currency: STORE_CURRENCY,
              provider: "bach",
              status: "pending",
            },
          },
        },
        include: orderInclude,
      });

      // Consuming the cart last: a second concurrent checkout will see empty cart
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return created;
    });

    let checkoutUrl: string | null = null;
    let paymentInitError: string | null = null;

    try {
      const session = await attachBachsCheckout({
        id: order.id,
        totalAmountKobo: order.totalAmountKobo,
        currency: order.currency,
        payment: order.payment,
        user,
      });
      checkoutUrl = session?.checkoutUrl ?? null;
    } catch (err) {
      paymentInitError =
        err instanceof Error ? err.message : "Failed to start Bachs checkout";
    }

    const refreshed = await prisma.aStoreOrder.findUnique({
      where: { id: order.id },
      include: orderInclude,
    });

    return ServiceResponse.success(
      paymentInitError
        ? "Order placed, but payment link could not be created yet"
        : "Order placed successfully",
      {
        ...refreshed,
        checkoutUrl,
        paymentInitError,
      },
      StatusCodes.CREATED
    );
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "EMPTY_CART") {
        return ServiceResponse.failure(
          "Cart is empty",
          null,
          StatusCodes.BAD_REQUEST
        );
      }
      if (err.message === "CURRENCY") {
        return ServiceResponse.failure(
          `Only ${STORE_CURRENCY} checkout is supported`,
          null,
          StatusCodes.CONFLICT
        );
      }
      if (err.message.startsWith("STOCK:")) {
        return ServiceResponse.failure(
          `Not enough stock for "${err.message.slice("STOCK:".length)}"`,
          null,
          StatusCodes.CONFLICT
        );
      }
      if (err.message.startsWith("UNAVAILABLE:")) {
        return ServiceResponse.failure(
          `Product "${err.message.slice("UNAVAILABLE:".length)}" is no longer available`,
          null,
          StatusCodes.CONFLICT
        );
      }
      if (err.message.startsWith("OPTION:")) {
        return ServiceResponse.failure(
          `A selected option for "${err.message.slice("OPTION:".length)}" is unavailable`,
          null,
          StatusCodes.CONFLICT
        );
      }
    }
    throw err;
  }
};

/** POST /api/v1/orders/:id/pay — (re)start Bachs checkout for a pending payment */
export const startPayment = async (userId: string, orderId: string) => {
  const order = await prisma.aStoreOrder.findFirst({
    where: { id: orderId, userId },
    include: {
      ...orderInclude,
      user: { select: { email: true, name: true } },
    },
  });

  if (!order) {
    return ServiceResponse.failure(
      "Order not found",
      null,
      StatusCodes.NOT_FOUND
    );
  }

  if (!order.payment) {
    return ServiceResponse.failure(
      "Order has no payment",
      null,
      StatusCodes.CONFLICT
    );
  }

  if (order.payment.status !== "pending") {
    return ServiceResponse.failure(
      "Payment is not pending",
      null,
      StatusCodes.CONFLICT
    );
  }

  if (order.status === "cancelled") {
    return ServiceResponse.failure(
      "Order is cancelled",
      null,
      StatusCodes.CONFLICT
    );
  }

  try {
    const session = await attachBachsCheckout({
      id: order.id,
      totalAmountKobo: order.totalAmountKobo,
      currency: order.currency,
      payment: order.payment,
      user: order.user,
    });

    const refreshed = await prisma.aStoreOrder.findUnique({
      where: { id: order.id },
      include: orderInclude,
    });

    return ServiceResponse.success("Payment session created", {
      ...refreshed,
      checkoutUrl: session.checkoutUrl,
    });
  } catch (err) {
    return ServiceResponse.failure(
      err instanceof Error ? err.message : "Failed to start payment",
      null,
      StatusCodes.BAD_GATEWAY
    );
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
