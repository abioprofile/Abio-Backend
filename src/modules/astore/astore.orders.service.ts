import { StatusCodes } from "http-status-codes";
import type { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/shared/config/database";
import {
  getPagination,
  getTotalPages,
} from "@/shared/utils/pagination";
import { ServiceResponse } from "@/shared/utils/serviceResponse";
import {
  failPendingPaymentAndReleaseStock,
  lockPaymentById,
  restockOrderVariants,
} from "@/modules/payments/payment-lifecycle";
import type { TListOrdersQuery, TUpdateOrderBody } from "./astore.schemas";

const adminOrderInclude = {
  user: {
    select: {
      id: true,
      email: true,
      name: true,
    },
  },
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
      failedAt: true,
      createdAt: true,
    },
  },
} as const;

/** Allowed next statuses from each fulfillment state. */
const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  processing: ["ready", "cancelled"],
  ready: ["shipped", "cancelled"],
  shipped: ["received"],
  received: [],
  cancelled: [],
};

const FULFILLMENT_STATUSES: ReadonlySet<OrderStatus> = new Set([
  "ready",
  "shipped",
  "received",
]);

/** GET /api/v1/admin/astore/orders */
export const listOrders = async (query: TListOrdersQuery) => {
  const { page, limit, skip } = getPagination(query as Record<string, unknown>);
  const where: Prisma.AStoreOrderWhereInput = {};

  if (query.status) {
    where.status = query.status;
  }

  if (query.paymentStatus) {
    where.payment = { status: query.paymentStatus };
  }

  if (query.q) {
    where.OR = [
      { id: { equals: query.q } },
      { trackingNumber: { contains: query.q, mode: "insensitive" } },
      { user: { email: { contains: query.q, mode: "insensitive" } } },
      { user: { name: { contains: query.q, mode: "insensitive" } } },
    ];
  }

  const [total, orders] = await Promise.all([
    prisma.aStoreOrder.count({ where }),
    prisma.aStoreOrder.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: adminOrderInclude,
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

/** GET /api/v1/admin/astore/orders/:id */
export const getOrderById = async (id: string) => {
  const order = await prisma.aStoreOrder.findUnique({
    where: { id },
    include: adminOrderInclude,
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

/** PATCH /api/v1/admin/astore/orders/:id — status / tracking */
export const updateOrder = async (
  id: string,
  body: TUpdateOrderBody,
  actorId: string
) => {
  const existing = await prisma.aStoreOrder.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      trackingNumber: true,
      payment: {
        select: { id: true, status: true },
      },
    },
  });

  if (!existing) {
    return ServiceResponse.failure(
      "Order not found",
      null,
      StatusCodes.NOT_FOUND
    );
  }

  if (existing.status === "cancelled" && body.status !== undefined) {
    return ServiceResponse.failure(
      "Cancelled orders cannot change status",
      null,
      StatusCodes.CONFLICT
    );
  }

  if (body.status !== undefined && body.status !== existing.status) {
    const next = body.status;
    const allowed = ALLOWED_TRANSITIONS[existing.status];

    if (!allowed.includes(next)) {
      return ServiceResponse.failure(
        `Invalid status transition: ${existing.status} → ${next}`,
        null,
        StatusCodes.CONFLICT
      );
    }

    if (FULFILLMENT_STATUSES.has(next)) {
      if (existing.payment?.status !== "success") {
        return ServiceResponse.failure(
          "Fulfillment requires a successful payment",
          null,
          StatusCodes.CONFLICT
        );
      }
    }

    if (next === "cancelled") {
      if (
        existing.payment?.status === "success" ||
        existing.payment?.status === "reversed"
      ) {
        return ServiceResponse.failure(
          "Cannot cancel a paid order until refunds are supported",
          null,
          StatusCodes.CONFLICT
        );
      }
    }
  }

  const order = await prisma.$transaction(async (tx) => {
    if (body.status === "cancelled" && existing.status !== "cancelled") {
      if (existing.payment?.status === "pending" && existing.payment.id) {
        const locked = await lockPaymentById(tx, existing.payment.id);
        if (locked) {
          await failPendingPaymentAndReleaseStock(tx, locked);
        }
      } else if (existing.payment?.status !== "failed") {
        // Unpaid with no pending row, or missing payment — release reserved stock
        await restockOrderVariants(tx, id);
      }
      // payment already failed → stock already restored by fail/webhook path
    }

    const updated = await tx.aStoreOrder.update({
      where: { id },
      data: {
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.trackingNumber !== undefined
          ? { trackingNumber: body.trackingNumber }
          : {}),
      },
      include: adminOrderInclude,
    });

    await tx.adminAuditLog.create({
      data: {
        adminId: actorId,
        action: "astore.order.update",
        resourceType: "astore_order",
        resourceId: id,
        oldValue: {
          status: existing.status,
          trackingNumber: existing.trackingNumber,
        },
        newValue: body,
      },
    });

    return updated;
  });

  return ServiceResponse.success("Order updated successfully", order);
};
