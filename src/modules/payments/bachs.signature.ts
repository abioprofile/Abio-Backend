import crypto from "crypto";
import env from "@/env";

/** Bachs: HMAC-SHA256 of "{timestamp}.{rawBody}" */
export const verifyBachsSignature = (
  rawBody: string,
  secret: string,
  timestampHeader: string,
  signatureHeader: string,
  toleranceSeconds = 300
): boolean => {
  const timestamp = Number.parseInt(timestampHeader, 10);
  if (!Number.isFinite(timestamp) || !signatureHeader) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > toleranceSeconds) {
    return false;
  }

  const message = `${timestamp}.${rawBody}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(message, "utf8")
    .digest("hex");

  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signatureHeader, "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
};

export const getBachsWebhookSecret = () =>
  process.env.BACHS_WEBHOOK_SECRET || env.BACHS_WEBHOOK_SECRET;

/** "75000.00" NGN → 7500000 kobo */
export const bachsAmountToKobo = (amount: string): number => {
  const n = Number.parseFloat(amount);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100);
};
