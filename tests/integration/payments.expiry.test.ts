import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { expireStalePendingPayments } from "@/modules/payments/payment-lifecycle";
import { testApp } from "../helpers/testApp";
import {
  authHeader,
  createAdminUser,
  createTestUser,
} from "../helpers/factories";

describe("Payment pending TTL expiry", () => {
  let userId: string;
  let variantId: string;
  let paymentId: string;
  let orderId: string;

  beforeEach(async () => {
    const user = await createTestUser();
    const admin = await createAdminUser();
    userId = user.id;
    const adminHeaders = authHeader(admin.id);

    const product = await testApp
      .post("/api/v1/admin/astore/products")
      .set(adminHeaders)
      .send({
        name: "Expiry Tee",
        type: "standard",
        basePriceKobo: 50000,
      });

    const variant = await testApp
      .post(`/api/v1/admin/astore/products/${product.body.data.id}/variants`)
      .set(adminHeaders)
      .send({ colorName: "Green", stockQty: 4, priceKobo: 50000 });
    variantId = variant.body.data.id;

    const order = await prisma.aStoreOrder.create({
      data: {
        userId,
        status: "processing",
        totalAmountKobo: 50000,
        currency: "NGN",
        items: {
          create: {
            productId: product.body.data.id,
            variantId,
            quantity: 1,
            unitPriceKobo: 50000,
          },
        },
        payment: {
          create: {
            userId,
            amountKobo: 50000,
            currency: "NGN",
            provider: "bach",
            status: "pending",
          },
        },
      },
      include: { payment: true },
    });

    await prisma.aStoreProductVariant.update({
      where: { id: variantId },
      data: { stockQty: 3 },
    });

    // Backdate payment so it looks abandoned
    const staleAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await prisma.payment.update({
      where: { id: order.payment!.id },
      data: { createdAt: staleAt },
    });

    orderId = order.id;
    paymentId = order.payment!.id;
  });

  it("expires stale pending payments, cancels order, restocks", async () => {
    const cutoff = new Date(Date.now() - 60 * 60 * 1000);
    const result = await expireStalePendingPayments(cutoff);

    expect(result.released).toBeGreaterThanOrEqual(1);

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    expect(payment?.status).toBe("failed");

    const order = await prisma.aStoreOrder.findUnique({ where: { id: orderId } });
    expect(order?.status).toBe("cancelled");

    const variant = await prisma.aStoreProductVariant.findUnique({
      where: { id: variantId },
    });
    expect(variant?.stockQty).toBe(4);
  });

  it("does not expire fresh pending payments", async () => {
    await prisma.payment.update({
      where: { id: paymentId },
      data: { createdAt: new Date() },
    });

    const cutoff = new Date(Date.now() - 60 * 60 * 1000);
    const result = await expireStalePendingPayments(cutoff);

    expect(result.released).toBe(0);

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    expect(payment?.status).toBe("pending");
  });
});
