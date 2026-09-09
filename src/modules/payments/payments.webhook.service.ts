import { StatusCodes } from "http-status-codes";
import { prisma } from "@/shared/config/database";
import { ServiceResponse } from "@/shared/utils/serviceResponse";
import {
  bachsAmountToKobo,
  getBachsWebhookSecret,
  verifyBachsSignature,
} from "./bachs.signature";
import {
  alreadySawEvent,
  appendEventId,
  failPendingPaymentAndReleaseStock,
  lockPaymentById,
  succeedPendingPayment,
} from "./payment-lifecycle";

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

const findPaymentIdForEvent = async (data: BachsEvent["data"]) => {
  if (!data) return null;

  if (data.checkout_id) {
    const byRef = await prisma.payment.findFirst({
      where: { providerRef: data.checkout_id },
      select: { id: true },
    });
    if (byRef) return byRef.id;
  }

  const orderId = data.metadata?.order_id || data.reference || undefined;
  if (orderId) {
    const byOrder = await prisma.payment.findFirst({
      where: { orderId },
      select: { id: true },
    });
    if (byOrder) return byOrder.id;
  }

  if (data.metadata?.payment_id) {
    return data.metadata.payment_id;
  }

  return null;
};

/**
 * Handle a verified Bachs webhook body (already signature-checked).
 * Status transitions + event idempotency run under FOR UPDATE lock.
 */
export const handleBachsWebhookEvent = async (event: BachsEvent) => {
  const type = event.type;
  const data = event.data;

  if (type !== "collection.succeeded" && type !== "collection.failed") {
    return ServiceResponse.success("Event ignored", { ignored: true, type });
  }

  const paymentId = await findPaymentIdForEvent(data);
  if (!paymentId) {
    return ServiceResponse.failure(
      "Payment not found for webhook",
      null,
      StatusCodes.NOT_FOUND
    );
  }

  if (type === "collection.succeeded" && data?.amount) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: { amountKobo: true },
    });
    if (payment) {
      const kobo = bachsAmountToKobo(data.amount);
      if (Number.isFinite(kobo) && kobo !== payment.amountKobo) {
        return ServiceResponse.failure(
          "Webhook amount does not match payment",
          null,
          StatusCodes.CONFLICT
        );
      }
    }
  }

  return prisma.$transaction(async (tx) => {
    const locked = await lockPaymentById(tx, paymentId);
    if (!locked) {
      return ServiceResponse.failure(
        "Payment not found for webhook",
        null,
        StatusCodes.NOT_FOUND
      );
    }

    if (alreadySawEvent(locked.rawWebhook, event.id)) {
      return ServiceResponse.success("Event already processed", {
        paymentId: locked.id,
        status: locked.status,
      });
    }

    const nextWebhook = appendEventId(locked.rawWebhook, event.id, event);

    if (type === "collection.succeeded") {
      const result = await succeedPendingPayment(tx, locked, {
        providerRef: data?.checkout_id || locked.providerRef,
        rawWebhook: nextWebhook,
      });

      if (result === "blocked") {
        return ServiceResponse.failure(
          "Cannot mark a failed/reversed payment as successful",
          null,
          StatusCodes.CONFLICT
        );
      }

      return ServiceResponse.success(
        result === "noop"
          ? "Payment already successful"
          : "Payment marked successful",
        {
          paymentId: locked.id,
          orderId: locked.orderId,
        }
      );
    }

    // collection.failed
    if (locked.status === "success") {
      return ServiceResponse.failure(
        "Cannot fail a successful payment via webhook",
        null,
        StatusCodes.CONFLICT
      );
    }

    if (locked.status === "failed") {
      await tx.payment.update({
        where: { id: locked.id },
        data: { rawWebhook: nextWebhook },
      });
      return ServiceResponse.success("Payment already failed", {
        paymentId: locked.id,
      });
    }

    const released = await failPendingPaymentAndReleaseStock(tx, locked, {
      providerRef: data?.checkout_id || locked.providerRef,
      rawWebhook: nextWebhook,
    });

    if (!released) {
      return ServiceResponse.success("Payment already failed", {
        paymentId: locked.id,
      });
    }

    return ServiceResponse.success("Payment marked failed and stock restored", {
      paymentId: locked.id,
      orderId: locked.orderId,
    });
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
