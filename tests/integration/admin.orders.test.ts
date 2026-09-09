import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { testApp } from "../helpers/testApp";
import {
  authHeader,
  createAdminUser,
  createTestUser,
} from "../helpers/factories";

const ADMIN_ORDERS = "/api/v1/admin/astore/orders";
const ADMIN_PRODUCTS = "/api/v1/admin/astore/products";

describe("Admin AStore orders", () => {
  let userHeaders: { Authorization: string };
  let adminHeaders: { Authorization: string };
  let adminId: string;
  let userId: string;
  let buyerEmail: string;
  let orderId: string;

  beforeEach(async () => {
    const user = await createTestUser({ name: "Order Buyer" });
    const admin = await createAdminUser({ name: "Orders Staff" });
    userId = user.id;
    buyerEmail = user.email;
    adminId = admin.id;
    userHeaders = authHeader(user.id);
    adminHeaders = authHeader(admin.id);

    const product = await testApp
      .post(ADMIN_PRODUCTS)
      .set(adminHeaders)
      .send({
        name: "Admin Order Tee",
        type: "standard",
        basePriceKobo: 250000,
      });

    const variant = await testApp
      .post(`${ADMIN_PRODUCTS}/${product.body.data.id}/variants`)
      .set(adminHeaders)
      .send({ colorName: "Red", stockQty: 3, priceKobo: 250000 });

    const order = await prisma.aStoreOrder.create({
      data: {
        userId,
        status: "processing",
        totalAmountKobo: 250000,
        currency: "NGN",
        shippingAddress: "1 Admin Test Ave",
        items: {
          create: {
            productId: product.body.data.id,
            variantId: variant.body.data.id,
            quantity: 1,
            unitPriceKobo: 250000,
          },
        },
        payment: {
          create: {
            userId,
            amountKobo: 250000,
            currency: "NGN",
            provider: "bach",
            status: "success",
            paidAt: new Date(),
            providerRef: "chk_admin_order_1",
          },
        },
      },
    });

    orderId = order.id;
  });

  it("rejects unauthenticated and non-staff", async () => {
    const anon = await testApp.get(ADMIN_ORDERS);
    expect(anon.status).toBe(401);

    const user = await testApp.get(ADMIN_ORDERS).set(userHeaders);
    expect(user.status).toBe(403);
  });

  it("lists all orders with user + payment", async () => {
    const res = await testApp.get(ADMIN_ORDERS).set(adminHeaders);
    expect(res.status).toBe(200);
    expect(res.body.data.orders.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.orders[0].user.email).toBe(buyerEmail);
    expect(res.body.data.orders[0].payment.status).toBe("success");
  });

  it("filters by status and paymentStatus", async () => {
    const byStatus = await testApp
      .get(ADMIN_ORDERS)
      .query({ status: "processing" })
      .set(adminHeaders);
    expect(byStatus.status).toBe(200);
    expect(
      byStatus.body.data.orders.every(
        (o: { status: string }) => o.status === "processing"
      )
    ).toBe(true);

    const byPay = await testApp
      .get(ADMIN_ORDERS)
      .query({ paymentStatus: "success" })
      .set(adminHeaders);
    expect(byPay.status).toBe(200);
    expect(
      byPay.body.data.orders.every(
        (o: { payment: { status: string } }) => o.payment.status === "success"
      )
    ).toBe(true);
  });

  it("gets a single order by id", async () => {
    const res = await testApp
      .get(`${ADMIN_ORDERS}/${orderId}`)
      .set(adminHeaders);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(orderId);
    expect(res.body.data.items).toHaveLength(1);
  });

  it("updates status along valid transitions with audit", async () => {
    const ready = await testApp
      .patch(`${ADMIN_ORDERS}/${orderId}`)
      .set(adminHeaders)
      .send({ status: "ready" });
    expect(ready.status).toBe(200);
    expect(ready.body.data.status).toBe("ready");

    const shipped = await testApp
      .patch(`${ADMIN_ORDERS}/${orderId}`)
      .set(adminHeaders)
      .send({ status: "shipped", trackingNumber: "NG-TRACK-001" });

    expect(shipped.status).toBe(200);
    expect(shipped.body.data.status).toBe("shipped");
    expect(shipped.body.data.trackingNumber).toBe("NG-TRACK-001");

    const audit = await prisma.adminAuditLog.findFirst({
      where: {
        adminId,
        action: "astore.order.update",
        resourceId: orderId,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).not.toBeNull();
  });

  it("rejects invalid fulfillment jumps and unpaid fulfillment", async () => {
    const jump = await testApp
      .patch(`${ADMIN_ORDERS}/${orderId}`)
      .set(adminHeaders)
      .send({ status: "shipped" });
    expect(jump.status).toBe(409);

    const unpaid = await prisma.aStoreOrder.create({
      data: {
        userId,
        status: "processing",
        totalAmountKobo: 1000,
        currency: "NGN",
        payment: {
          create: {
            userId,
            amountKobo: 1000,
            currency: "NGN",
            provider: "bach",
            status: "pending",
          },
        },
      },
    });

    const fulfillUnpaid = await testApp
      .patch(`${ADMIN_ORDERS}/${unpaid.id}`)
      .set(adminHeaders)
      .send({ status: "ready" });
    expect(fulfillUnpaid.status).toBe(409);
  });

  it("rejects cancel of a paid order", async () => {
    const res = await testApp
      .patch(`${ADMIN_ORDERS}/${orderId}`)
      .set(adminHeaders)
      .send({ status: "cancelled" });
    expect(res.status).toBe(409);
  });

  it("cancels unpaid pending order and restocks", async () => {
    const product = await testApp
      .post(ADMIN_PRODUCTS)
      .set(adminHeaders)
      .send({
        name: "Cancel Tee",
        type: "standard",
        basePriceKobo: 100000,
      });
    const variant = await testApp
      .post(`${ADMIN_PRODUCTS}/${product.body.data.id}/variants`)
      .set(adminHeaders)
      .send({ colorName: "Black", stockQty: 2, priceKobo: 100000 });

    const order = await prisma.aStoreOrder.create({
      data: {
        userId,
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
            userId,
            amountKobo: 100000,
            currency: "NGN",
            provider: "bach",
            status: "pending",
          },
        },
      },
    });

    await prisma.aStoreProductVariant.update({
      where: { id: variant.body.data.id },
      data: { stockQty: 1 },
    });

    const res = await testApp
      .patch(`${ADMIN_ORDERS}/${order.id}`)
      .set(adminHeaders)
      .send({ status: "cancelled" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("cancelled");

    const payment = await prisma.payment.findFirst({
      where: { orderId: order.id },
    });
    expect(payment?.status).toBe("failed");

    const stock = await prisma.aStoreProductVariant.findUnique({
      where: { id: variant.body.data.id },
    });
    expect(stock?.stockQty).toBe(2);
  });

  it("returns 404 for unknown order", async () => {
    const res = await testApp
      .get(`${ADMIN_ORDERS}/00000000-0000-4000-8000-000000000099`)
      .set(adminHeaders);
    expect(res.status).toBe(404);
  });
});
