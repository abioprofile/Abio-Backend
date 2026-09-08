import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { testApp } from "../helpers/testApp";
import {
  authHeader,
  createAdminUser,
  createTestUser,
} from "../helpers/factories";

const ORDERS = "/api/v1/orders";
const CART = "/api/v1/cart";
const ADMIN = "/api/v1/admin/astore";

describe("Orders API", () => {
  let userHeaders: { Authorization: string };
  let adminHeaders: { Authorization: string };
  let productId: string;
  let variantId: string;

  beforeEach(async () => {
    const user = await createTestUser();
    const admin = await createAdminUser({ name: "Orders Admin" });
    userHeaders = authHeader(user.id);
    adminHeaders = authHeader(admin.id);

    const product = await testApp
      .post(`${ADMIN}/products`)
      .set(adminHeaders)
      .send({
        name: "Checkout Tee",
        type: "standard",
        basePriceKobo: 400000,
      });
    productId = product.body.data.id;

    const variant = await testApp
      .post(`${ADMIN}/products/${productId}/variants`)
      .set(adminHeaders)
      .send({
        colorName: "White",
        stockQty: 5,
        priceKobo: 420000,
      });
    variantId = variant.body.data.id;
  });

  it("rejects checkout with empty cart", async () => {
    const res = await testApp
      .post(`${ORDERS}/checkout`)
      .set(userHeaders)
      .send({});
    expect(res.status).toBe(400);
  });

  it("checks out cart into order + pending payment and clears cart", async () => {
    await testApp
      .post(`${CART}/items`)
      .set(userHeaders)
      .send({ productId, variantId, quantity: 2 });

    const res = await testApp
      .post(`${ORDERS}/checkout`)
      .set(userHeaders)
      .send({ shippingAddress: "12 Admiralty Way, Lagos" });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      status: "processing",
      totalAmountKobo: 840000,
      shippingAddress: "12 Admiralty Way, Lagos",
    });
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.payment).toMatchObject({
      status: "pending",
      amountKobo: 840000,
      provider: "bach",
    });

    const cart = await testApp.get(CART).set(userHeaders);
    expect(cart.body.data.items).toHaveLength(0);

    const variant = await prisma.aStoreProductVariant.findUnique({
      where: { id: variantId },
    });
    expect(variant?.stockQty).toBe(3);
  });

  it("lists and gets my orders", async () => {
    await testApp
      .post(`${CART}/items`)
      .set(userHeaders)
      .send({ productId, variantId, quantity: 1 });

    const placed = await testApp
      .post(`${ORDERS}/checkout`)
      .set(userHeaders)
      .send({});

    const list = await testApp.get(ORDERS).set(userHeaders);
    expect(list.status).toBe(200);
    expect(list.body.data.orders.length).toBeGreaterThanOrEqual(1);

    const detail = await testApp
      .get(`${ORDERS}/${placed.body.data.id}`)
      .set(userHeaders);
    expect(detail.status).toBe(200);
    expect(detail.body.data.id).toBe(placed.body.data.id);
  });

  it("rejects checkout when stock is insufficient", async () => {
    await testApp
      .post(`${CART}/items`)
      .set(userHeaders)
      .send({ productId, variantId, quantity: 99 });

    const res = await testApp
      .post(`${ORDERS}/checkout`)
      .set(userHeaders)
      .send({});

    expect(res.status).toBe(409);
  });
});
