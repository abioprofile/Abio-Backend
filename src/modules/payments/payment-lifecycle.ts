import type { Prisma } from "@prisma/client";
import { prisma } from "@/shared/config/database";

/** Interactive `$transaction` client from our extended Prisma instance */
export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

type PaymentLockRow = {
  id: string;
  orderId: string;
  status: string;
  amountKobo: number;
  providerRef: string | null;
  rawWebhook: Prisma.JsonValue | null;
};

export const alreadySawEvent = (
  rawWebhook: Prisma.JsonValue | null,
  eventId: string
): boolean => {
  if (!rawWebhook || typeof rawWebhook !== "object" || Array.isArray(rawWebhook)) {
    return false;
  }
  const events = (rawWebhook as { eventIds?: unknown }).eventIds;
  return Array.isArray(events) && events.includes(eventId);
};

export const appendEventId = (
  rawWebhook: Prisma.JsonValue | null,
  eventId: string,
  payload: unknown
): Prisma.InputJsonValue => {
  const base =
    rawWebhook && typeof rawWebhook === "object" && !Array.isArray(rawWebhook)
      ? (rawWebhook as Record<string, unknown>)
      : {};
  const prev = Array.isArray(base.eventIds) ? (base.eventIds as string[]) : [];
  return {
    ...base,
    eventIds: [...prev, eventId],
    lastEvent: payload,
  } as Prisma.InputJsonValue;
};

/** Lock a payment row for the duration of the current transaction. */
export const lockPaymentById = async (
  tx: Tx,
  paymentId: string
): Promise<PaymentLockRow | null> => {
  const rows = await tx.$queryRaw<PaymentLockRow[]>`
    SELECT id, "orderId", status, "amountKobo", "providerRef", "rawWebhook"
    FROM payments
    WHERE id = ${paymentId}
    FOR UPDATE
  `;
  return rows[0] ?? null;
};

export const restockOrderVariants = async (tx: Tx, orderId: string) => {
  const items = await tx.aStoreOrderItem.findMany({
    where: { orderId, variantId: { not: null } },
    select: {
      variantId: true,
      quantity: true,
      product: { select: { type: true } },
    },
  });

  for (const item of items) {
    // Custom products are MTO — only restore stock held for standard lines
    if (!item.variantId || item.product.type !== "standard") continue;
    await tx.aStoreProductVariant.update({
      where: { id: item.variantId },
      data: { stockQty: { increment: item.quantity } },
    });
  }
};

/**
 * Atomically move pending → failed, cancel order, restock.
 * Returns false if another worker already left pending (lost the race).
 */
export const failPendingPaymentAndReleaseStock = async (
  tx: Tx,
  payment: PaymentLockRow,
  opts: {
    providerRef?: string | null;
    rawWebhook?: Prisma.InputJsonValue;
    reviewNote?: string;
  } = {}
): Promise<boolean> => {
  if (payment.status !== "pending") {
    return false;
  }

  const updated = await tx.payment.updateMany({
    where: { id: payment.id, status: "pending" },
    data: {
      status: "failed",
      failedAt: new Date(),
      ...(opts.providerRef !== undefined
        ? { providerRef: opts.providerRef }
        : {}),
      ...(opts.rawWebhook !== undefined ? { rawWebhook: opts.rawWebhook } : {}),
    },
  });

  if (updated.count !== 1) {
    return false;
  }

  await tx.aStoreOrder.updateMany({
    where: {
      id: payment.orderId,
      status: { in: ["processing", "ready"] },
    },
    data: { status: "cancelled" },
  });

  await restockOrderVariants(tx, payment.orderId);
  return true;
};

/**
 * Atomically move pending → success.
 * Rejects (returns 'blocked') if payment is already failed/reversed.
 */
export const succeedPendingPayment = async (
  tx: Tx,
  payment: PaymentLockRow,
  opts: {
    providerRef?: string | null;
    rawWebhook: Prisma.InputJsonValue;
  }
): Promise<"ok" | "noop" | "blocked"> => {
  if (payment.status === "success") {
    await tx.payment.update({
      where: { id: payment.id },
      data: { rawWebhook: opts.rawWebhook },
    });
    return "noop";
  }

  if (payment.status !== "pending") {
    return "blocked";
  }

  const updated = await tx.payment.updateMany({
    where: { id: payment.id, status: "pending" },
    data: {
      status: "success",
      paidAt: new Date(),
      failedAt: null,
      providerRef: opts.providerRef ?? payment.providerRef,
      rawWebhook: opts.rawWebhook,
    },
  });

  return updated.count === 1 ? "ok" : "noop";
};

/** Expire stale pending payments (used by worker + tests). */
export const expireStalePendingPayments = async (olderThan: Date) => {
  const stale = await prisma.payment.findMany({
    where: {
      status: "pending",
      createdAt: { lt: olderThan },
    },
    select: { id: true },
    take: 100,
    orderBy: { createdAt: "asc" },
  });

  let released = 0;

  for (const row of stale) {
    const ok = await prisma.$transaction(async (tx) => {
      const locked = await lockPaymentById(tx, row.id);
      if (!locked) return false;
      return failPendingPaymentAndReleaseStock(tx, locked, {
        rawWebhook: appendEventId(locked.rawWebhook, `expire:${row.id}`, {
          reason: "pending_ttl_expired",
          expiredBefore: olderThan.toISOString(),
        }),
      });
    });
    if (ok) released += 1;
  }

  return { scanned: stale.length, released };
};
