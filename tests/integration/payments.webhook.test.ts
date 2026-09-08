import crypto from "crypto";
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { testApp } from "../helpers/testApp";
import {
  authHeader,
  createAdminUser,
  createTestUser,
} from "../helpers/factories";

const WEBHOOK = "/api/v1/payments/webhooks/bach";
const SECRET = "test_webhook_secret_for_bachs";

const signBody = (rawBody: string, secret: string, timestamp: number) => {
  const message = `${timestamp}.${rawBody}`;
  return crypto.createHmac("sha256", secret).update(message, "utf8").digest("hex");
};

describe("Bachs webhook", () => {
  let adminHeaders: { Authorization: string };
  let userId: string;
  let orderId: string;
  let paymentId: string;
  let variantId: string;
  let checkoutId: string;

  beforeEach(async () => {
    process.env.BACHS_WEBHOOK_SECRET = SECRET;

    const user = await createTestUser();
    const admin = await createAdminUser();
    userId = user.id;
    adminHeaders = authHeader(admin.id);

    const product = await testApp
      .post("/api/v1/admin/astore/products")
      .set(adminHeaders)
      .send({
        name: "Webhook Tee",
        type: "standard",
        basePriceKobo: 100000,
      });

    const variant = await testApp
      .post(`/api/v1/admin/astore/products/${product.body.data.id}/variants`)
      .set(adminHeaders)
      .send({ colorName: "Blue", stockQty: 5, priceKobo: 100000 });
    variantId = variant.body.data.id;

    // Simulate order created by checkout (without calling Bachs)
    const order = await prisma.aStoreOrder.create({
      data: {
        userId,
        status: "processing",
        totalAmountKobo: 100000,
        currency: "NGN",
        items: {
          create: {
            productId: product.body.data.id,
            variantId,
            quantity: 1,
            unitPriceKobo: 100000,
          },
        },
        payment: {
          create: {
            userId,
            amountKobo: 100000,
            currency: "NGN",
            provider: "bach",
            status: "pending",
            providerRef: "chk_webhook_test_1",
          },
        },
      },
      include: { payment: true },
    });

    // Stock already "reserved" like checkout would
    await prisma.aStoreProductVariant.update({
      where: { id: variantId },
      data: { stockQty: 4 },
    });

    orderId = order.id;
    paymentId = order.payment!.id;
    checkoutId = "chk_webhook_test_1";
  });

  it("rejects invalid signature", async () => {
    const body = JSON.stringify({
      id: "evt_bad",
      type: "collection.succeeded",
      data: { checkout_id: checkoutId, amount: "1000.00" },
    });

    const res = await testApp
      .post(WEBHOOK)
      .set("Content-Type", "application/json")
      .set("X-Bachs-Timestamp", String(Math.floor(Date.now() / 1000)))
      .set("X-Bachs-Signature", "deadbeef")
      .send(body);

    expect(res.status).toBe(401);
  });

  it("marks payment successful on collection.succeeded", async () => {
    const payload = {
      id: "evt_success_1",
      type: "collection.succeeded",
      data: {
        checkout_id: checkoutId,
        amount: "1000.00",
        currency: "NGN",
        metadata: { order_id: orderId, payment_id: paymentId },
      },
    };
    const raw = JSON.stringify(payload);
    const ts = Math.floor(Date.now() / 1000);

    const res = await testApp
      .post(WEBHOOK)
      .set("Content-Type", "application/json")
      .set("X-Bachs-Timestamp", String(ts))
      .set("X-Bachs-Signature", signBody(raw, SECRET, ts))
      .send(raw);

    expect(res.status).toBe(200);

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    expect(payment?.status).toBe("success");
    expect(payment?.paidAt).not.toBeNull();
  });

  it("is idempotent for duplicate event ids", async () => {
    const payload = {
      id: "evt_success_dup",
      type: "collection.succeeded",
      data: {
        checkout_id: checkoutId,
        amount: "1000.00",
        currency: "NGN",
      },
    };
    const raw = JSON.stringify(payload);
    const ts = Math.floor(Date.now() / 1000);
    const sig = signBody(raw, SECRET, ts);

    const first = await testApp
      .post(WEBHOOK)
      .set("Content-Type", "application/json")
      .set("X-Bachs-Timestamp", String(ts))
      .set("X-Bachs-Signature", sig)
      .send(raw);
    expect(first.status).toBe(200);

    const second = await testApp
      .post(WEBHOOK)
      .set("Content-Type", "application/json")
      .set("X-Bachs-Timestamp", String(ts))
      .set("X-Bachs-Signature", sig)
      .send(raw);
    expect(second.status).toBe(200);

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    expect(payment?.status).toBe("success");
  });

  it("marks failed, cancels order, and restocks", async () => {
    const payload = {
      id: "evt_fail_1",
      type: "collection.failed",
      data: {
        checkout_id: checkoutId,
        amount: "1000.00",
        currency: "NGN",
      },
    };
    const raw = JSON.stringify(payload);
    const ts = Math.floor(Date.now() / 1000);

    const res = await testApp
      .post(WEBHOOK)
      .set("Content-Type", "application/json")
      .set("X-Bachs-Timestamp", String(ts))
      .set("X-Bachs-Signature", signBody(raw, SECRET, ts))
      .send(raw);

    expect(res.status).toBe(200);

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    expect(payment?.status).toBe("failed");

    const order = await prisma.aStoreOrder.findUnique({ where: { id: orderId } });
    expect(order?.status).toBe("cancelled");

    const variant = await prisma.aStoreProductVariant.findUnique({
      where: { id: variantId },
    });
    expect(variant?.stockQty).toBe(5);
  });
});
