import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { testApp } from "../helpers/testApp";
import {
  authHeader,
  createAdminUser,
  createTestUser,
} from "../helpers/factories";

const METRICS = "/api/v1/admin/astore/metrics";
const ADMIN_PRODUCTS = "/api/v1/admin/astore/products";

describe("Admin AStore metrics", () => {
  let userHeaders: { Authorization: string };
  let adminHeaders: { Authorization: string };

  beforeEach(async () => {
    const user = await createTestUser({ name: "Metrics Buyer" });
    const admin = await createAdminUser({ name: "Metrics Admin" });
    userHeaders = authHeader(user.id);
    adminHeaders = authHeader(admin.id);

    const product = await testApp
      .post(ADMIN_PRODUCTS)
      .set(adminHeaders)
      .send({
        name: "Metrics Tee",
        type: "standard",
        basePriceKobo: 100000,
      });

    const variant = await testApp
      .post(`${ADMIN_PRODUCTS}/${product.body.data.id}/variants`)
      .set(adminHeaders)
      .send({ colorName: "Green", stockQty: 2, priceKobo: 100000 });

    await prisma.aStoreOrder.create({
      data: {
        userId: user.id,
        status: "processing",
        totalAmountKobo: 100000,
        currency: "NGN",
        items: {
          create: {
            productId: product.body.data.id,
            variantId: variant.body.data.id,
            quantity: 1,
            unitPriceKobo: 100000,
          },
        },
        payment: {
          create: {
            userId: user.id,
            amountKobo: 100000,
            currency: "NGN",
            provider: "bach",
            status: "success",
            paidAt: new Date(),
          },
        },
      },
    });

    await prisma.aStoreOrder.create({
      data: {
        userId: user.id,
        status: "cancelled",
        totalAmountKobo: 50000,
        currency: "NGN",
        items: {
          create: {
            productId: product.body.data.id,
            variantId: variant.body.data.id,
            quantity: 1,
            unitPriceKobo: 50000,
          },
        },
        payment: {
          create: {
            userId: user.id,
            amountKobo: 50000,
            currency: "NGN",
            provider: "bach",
            status: "failed",
            failedAt: new Date(),
          },
        },
      },
    });
  });

  it("rejects unauthenticated and non-staff", async () => {
    const anon = await testApp.get(METRICS);
    expect(anon.status).toBe(401);

    const user = await testApp.get(METRICS).set(userHeaders);
    expect(user.status).toBe(403);
  });

  it("returns aggregate dashboard metrics", async () => {
    const res = await testApp.get(METRICS).set(adminHeaders);
    expect(res.status).toBe(200);

    const data = res.body.data;
    expect(data.orders.total).toBeGreaterThanOrEqual(2);
    expect(data.orders.byStatus.processing).toBeGreaterThanOrEqual(1);
    expect(data.orders.byStatus.cancelled).toBeGreaterThanOrEqual(1);
    expect(data.payments.byStatus.success).toBeGreaterThanOrEqual(1);
    expect(data.payments.byStatus.failed).toBeGreaterThanOrEqual(1);
    expect(data.payments.revenueKobo).toBeGreaterThanOrEqual(100000);
    expect(data.payments.currency).toBe("NGN");
    expect(data.catalog.productsTotal).toBeGreaterThanOrEqual(1);
    expect(data.catalog.productsActive).toBeGreaterThanOrEqual(1);
    expect(data.users.total).toBeGreaterThanOrEqual(2);
    expect(data.recentOrders.length).toBeGreaterThanOrEqual(1);
    expect(data.recentOrders.length).toBeLessThanOrEqual(5);
    expect(data.range).toEqual({ from: null, to: null });
  });

  it("filters metrics by from/to date range", async () => {
    const farFuture = new Date("2099-01-01T00:00:00.000Z").toISOString();
    const res = await testApp
      .get(METRICS)
      .query({ from: farFuture })
      .set(adminHeaders);

    expect(res.status).toBe(200);
    expect(res.body.data.orders.total).toBe(0);
    expect(res.body.data.payments.revenueKobo).toBe(0);
    expect(res.body.data.range.from).toBe(farFuture);
  });
});
