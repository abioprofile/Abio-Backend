import env from "@/env";

/** Our DB stores kobo (int). Bachs wants decimal major units as a string. */
export const koboToBachsAmount = (kobo: number): string =>
  (kobo / 100).toFixed(2);

export type CreateBachsCheckoutInput = {
  amountKobo: number;
  currency: string;
  customerEmail: string;
  customerName: string;
  orderId: string;
  paymentId: string;
  successUrl: string;
  cancelUrl: string;
};

export type BachsCheckoutSession = {
  checkoutId: string;
  checkoutUrl: string;
  status: string;
  reference: string | null;
};

/**
 * Creates a Bachs hosted checkout for a raw amount (no Bachs product catalog).
 * Docs: POST /v1/checkout-sessions with `pricing` + `customer`.
 */
export const createBachsCheckoutSession = async (
  input: CreateBachsCheckoutInput
): Promise<BachsCheckoutSession> => {
  const secret = process.env.BACH_SECRET_KEY || env.BACH_SECRET_KEY;
  if (!secret) {
    throw new Error("BACH_SECRET_KEY is not configured");
  }

  const amount = koboToBachsAmount(input.amountKobo);
  const currency = input.currency.toUpperCase();

  const body = {
    customer: {
      email: input.customerEmail,
      name: input.customerName,
    },
    pricing: {
      currency,
      amount,
    },
    reference: input.orderId,
    metadata: {
      order_id: input.orderId,
      payment_id: input.paymentId,
    },
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    // Prefer NGN methods for our store; Bachs ignores corridors your account lacks
    payment_method_options:
      currency === "NGN"
        ? { NGN_BANK_TRANSFER: {}, NGN_CARD: {} }
        : undefined,
    expires_in_minutes: 60,
  };

  const res = await fetch(`${env.BACHS_BASE_URL}/v1/checkout-sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `order-${input.orderId}`,
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => ({}))) as {
    checkout_id?: string;
    checkout_url?: string;
    status?: string;
    reference?: string | null;
    detail?: string;
    error_code?: string;
  };

  if (!res.ok) {
    throw new Error(
      json.detail ||
        json.error_code ||
        `Bachs checkout failed with status ${res.status}`
    );
  }

  if (!json.checkout_id || !json.checkout_url) {
    throw new Error("Bachs checkout response missing checkout_id or checkout_url");
  }

  return {
    checkoutId: json.checkout_id,
    checkoutUrl: json.checkout_url,
    status: json.status ?? "open",
    reference: json.reference ?? null,
  };
};
