import { prisma } from "@/shared/config/database";
import { ServiceResponse } from "@/shared/utils/serviceResponse";

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
export const getMetrics = async () => {
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
      _count: { _all: true },
    }),
    prisma.payment.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.payment.aggregate({
      where: { status: "success" },
      _sum: { amountKobo: true },
    }),
    prisma.aStoreProduct.count(),
    prisma.aStoreProduct.count({ where: { active: true } }),
    prisma.user.count(),
    prisma.user.count({ where: { active: true } }),
    prisma.aStoreOrder.findMany({
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
