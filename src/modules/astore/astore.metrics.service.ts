import type { Prisma } from "@prisma/client";
import { StatusCodes } from "http-status-codes";
import { prisma } from "@/shared/config/database";
import { ServiceResponse } from "@/shared/utils/serviceResponse";
import type { TMetricsQuery } from "./astore.schemas";

const ORDER_STATUSES = [
  "processing",
  "ready",
  "shipped",
  "received",
  "cancelled",
] as const;

const PAYMENT_STATUSES = [
  "pending",
  "success",
  "failed",
  "reversed",
] as const;

const zeroOrderByStatus = () =>
  Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<
    (typeof ORDER_STATUSES)[number],
    number
  >;

const zeroPaymentByStatus = () =>
  Object.fromEntries(PAYMENT_STATUSES.map((s) => [s, 0])) as Record<
    (typeof PAYMENT_STATUSES)[number],
    number
  >;

/** GET /api/v1/admin/astore/metrics — store ops dashboard aggregates */
export const getMetrics = async (query: TMetricsQuery = {}) => {
  const from = query.from ? new Date(query.from) : undefined;
  const to = query.to ? new Date(query.to) : undefined;

  if (from && Number.isNaN(from.getTime())) {
    return ServiceResponse.failure(
      "Invalid from date",
      null,
      StatusCodes.BAD_REQUEST
    );
  }
  if (to && Number.isNaN(to.getTime())) {
    return ServiceResponse.failure(
      "Invalid to date",
      null,
      StatusCodes.BAD_REQUEST
    );
  }

  const createdAtFilter: Prisma.DateTimeFilter | undefined =
    from || to
      ? {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        }
      : undefined;

  const orderWhere: Prisma.AStoreOrderWhereInput = createdAtFilter
    ? { createdAt: createdAtFilter }
    : {};
  const paymentWhere: Prisma.PaymentWhereInput = createdAtFilter
    ? { createdAt: createdAtFilter }
    : {};

  const [
    orderGroups,
    paymentGroups,
    revenue,
    productsTotal,
    productsActive,
    usersTotal,
    usersActive,
    recentOrders,
  ] = await Promise.all([
    prisma.aStoreOrder.groupBy({
      by: ["status"],
      where: orderWhere,
      _count: { _all: true },
    }),
    prisma.payment.groupBy({
      by: ["status"],
      where: paymentWhere,
      _count: { _all: true },
    }),
    prisma.payment.aggregate({
      where: { status: "success", ...paymentWhere },
      _sum: { amountKobo: true },
    }),
    prisma.aStoreProduct.count(),
    prisma.aStoreProduct.count({ where: { active: true } }),
    prisma.user.count(),
    prisma.user.count({ where: { active: true } }),
    prisma.aStoreOrder.findMany({
      where: orderWhere,
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        totalAmountKobo: true,
        currency: true,
        trackingNumber: true,
        createdAt: true,
        user: {
          select: { id: true, name: true, email: true },
        },
        payment: {
          select: {
            id: true,
            status: true,
            amountKobo: true,
            paidAt: true,
          },
        },
      },
    }),
  ]);

  const ordersByStatus = zeroOrderByStatus();
  let ordersTotal = 0;
  for (const row of orderGroups) {
    ordersByStatus[row.status] = row._count._all;
    ordersTotal += row._count._all;
  }

  const paymentsByStatus = zeroPaymentByStatus();
  for (const row of paymentGroups) {
    paymentsByStatus[row.status] = row._count._all;
  }

  return ServiceResponse.success("Dashboard metrics retrieved successfully", {
    range: {
      from: from?.toISOString() ?? null,
      to: to?.toISOString() ?? null,
    },
    orders: {
      total: ordersTotal,
      byStatus: ordersByStatus,
    },
    payments: {
      byStatus: paymentsByStatus,
      revenueKobo: revenue._sum.amountKobo ?? 0,
      currency: "NGN",
    },
    catalog: {
      productsTotal,
      productsActive,
    },
    users: {
      total: usersTotal,
      active: usersActive,
    },
    recentOrders,
  });
};
