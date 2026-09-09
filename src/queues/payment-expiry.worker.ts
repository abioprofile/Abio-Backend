import type { Job } from "bull";
import env from "@/env";
import logger from "@/shared/config/logger";
import { expireStalePendingPayments } from "@/modules/payments/payment-lifecycle";
import { paymentExpiryQueue, type PaymentExpiryJob } from "./queue";

const REPEAT_EVERY_MS = 5 * 60 * 1000; // every 5 minutes

paymentExpiryQueue.process(async (_job: Job<PaymentExpiryJob>) => {
  const olderThan = new Date(
    Date.now() - env.PAYMENT_PENDING_TTL_MINUTES * 60 * 1000
  );

  const result = await expireStalePendingPayments(olderThan);

  logger.info(
    {
      olderThan: olderThan.toISOString(),
      ttlMinutes: env.PAYMENT_PENDING_TTL_MINUTES,
      ...result,
    },
    "Payment expiry sweep finished"
  );

  return result;
});

paymentExpiryQueue.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, err }, "Payment expiry job failed");
});

/** Register a single repeatable sweep (idempotent across restarts via jobId). */
void paymentExpiryQueue.add(
  { type: "EXPIRE_PENDING_PAYMENTS" },
  {
    jobId: "expire-pending-payments",
    repeat: { every: REPEAT_EVERY_MS },
  }
);

logger.info(
  {
    everyMs: REPEAT_EVERY_MS,
    ttlMinutes: env.PAYMENT_PENDING_TTL_MINUTES,
  },
  "Payment expiry worker registered"
);
