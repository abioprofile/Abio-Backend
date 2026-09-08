import { StatusCodes } from "http-status-codes";
import { Prisma } from "@prisma/client";
import { prisma } from "@/shared/config/database";
import { ServiceResponse } from "@/shared/utils/serviceResponse";
import {
  bachsAmountToKobo,
  getBachsWebhookSecret,
  verifyBachsSignature,
} from "./bachs.signature";

type BachsEvent = {
  id: string;
  type: string;
  created_at?: string;
  data?: {
    charge_id?: string | null;
    checkout_id?: string | null;
    reference?: string | null;
    status?: string;
    amount?: string;
    currency?: string;
    metadata?: {
      order_id?: string;
      payment_id?: string;
    };
  };
};

const findPaymentForEvent = async (data: BachsEvent["data"]) => {
  if (!data) return null;

  if (data.checkout_id) {
    const byRef = await prisma.payment.findFirst({
      where: { providerRef: data.checkout_id },
      include: { order: true },
    });
    if (byRef) return byRef;
  }

  const orderId = data.metadata?.order_id || data.reference || undefined;
  if (orderId) {
    return prisma.payment.findFirst({
      where: { orderId },
      include: { order: true },
    });
  }

  if (data.metadata?.payment_id) {
    return prisma.payment.findUnique({
      where: { id: data.metadata.payment_id },
      include: { order: true },
    });
  }

  return null;
};

const alreadySawEvent = (
  rawWebhook: Prisma.JsonValue | null,
  eventId: string
): boolean => {
  if (!rawWebhook || typeof rawWebhook !== "object" || Array.isArray(rawWebhook)) {
    return false;
  }
  const events = (rawWebhook as { eventIds?: unknown }).eventIds;
  return Array.isArray(events) && events.includes(eventId);
};

const appendEventId = (
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

/**
 * Handle a verified Bachs webhook body (already signature-checked).
 */
export const handleBachsWebhookEvent = async (event: BachsEvent) => {
  const type = event.type;
  const data = event.data;

  if (type !== "collection.succeeded" && type !== "collection.failed") {
    return ServiceResponse.success("Event ignored", { ignored: true, type });
  }

  const payment = await findPaymentForEvent(data);
  if (!payment) {
    return ServiceResponse.failure(
      "Payment not found for webhook",
      null,
      StatusCodes.NOT_FOUND
    );
  }

  if (alreadySawEvent(payment.rawWebhook, event.id)) {
    return ServiceResponse.success("Event already processed", {
      paymentId: payment.id,
      status: payment.status,
    });
  }

  if (type === "collection.succeeded") {
    if (payment.status === "success") {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          rawWebhook: appendEventId(payment.rawWebhook, event.id, event),
        },
      });
      return ServiceResponse.success("Payment already successful", {
        paymentId: payment.id,
      });
    }

    if (data?.amount) {
      const kobo = bachsAmountToKobo(data.amount);
      if (Number.isFinite(kobo) && kobo !== payment.amountKobo) {
        return ServiceResponse.failure(
          "Webhook amount does not match payment",
          null,
          StatusCodes.CONFLICT
        );
      }
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "success",
        paidAt: new Date(),
        failedAt: null,
        providerRef: data?.checkout_id || payment.providerRef,
        rawWebhook: appendEventId(payment.rawWebhook, event.id, event),
      },
    });

    return ServiceResponse.success("Payment marked successful", {
      paymentId: payment.id,
      orderId: payment.orderId,
    });
  }

  // collection.failed
  if (payment.status === "failed") {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        rawWebhook: appendEventId(payment.rawWebhook, event.id, event),
      },
    });
    return ServiceResponse.success("Payment already failed", {
      paymentId: payment.id,
    });
  }

  if (payment.status === "success") {
    return ServiceResponse.failure(
      "Cannot fail a successful payment via webhook",
      null,
      StatusCodes.CONFLICT
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "failed",
        failedAt: new Date(),
        providerRef: data?.checkout_id || payment.providerRef,
        rawWebhook: appendEventId(payment.rawWebhook, event.id, event),
      },
    });

    await tx.aStoreOrder.update({
      where: { id: payment.orderId },
      data: { status: "cancelled" },
    });

    const items = await tx.aStoreOrderItem.findMany({
      where: { orderId: payment.orderId, variantId: { not: null } },
      select: { variantId: true, quantity: true },
    });

    for (const item of items) {
      if (!item.variantId) continue;
      await tx.aStoreProductVariant.update({
        where: { id: item.variantId },
        data: { stockQty: { increment: item.quantity } },
      });
    }
  });

  return ServiceResponse.success("Payment marked failed and stock restored", {
    paymentId: payment.id,
    orderId: payment.orderId,
  });
};

export const processBachsWebhookRequest = async (input: {
  rawBody: string;
  timestampHeader?: string;
  signatureHeader?: string;
}) => {
  const secret = getBachsWebhookSecret();
  if (!secret) {
    return ServiceResponse.failure(
      "BACHS_WEBHOOK_SECRET is not configured",
      null,
      StatusCodes.SERVICE_UNAVAILABLE
    );
  }

  const ok = verifyBachsSignature(
    input.rawBody,
    secret,
    input.timestampHeader || "",
    input.signatureHeader || ""
  );

  if (!ok) {
    return ServiceResponse.failure(
      "Invalid webhook signature",
      null,
      StatusCodes.UNAUTHORIZED
    );
  }

  let event: BachsEvent;
  try {
    event = JSON.parse(input.rawBody) as BachsEvent;
  } catch {
    return ServiceResponse.failure(
      "Invalid JSON body",
      null,
      StatusCodes.BAD_REQUEST
    );
  }

  if (!event?.id || !event?.type) {
    return ServiceResponse.failure(
      "Invalid event envelope",
      null,
      StatusCodes.BAD_REQUEST
    );
  }

  return handleBachsWebhookEvent(event);
};
