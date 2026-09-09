import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { testApp } from "../helpers/testApp";
import {
  authHeader,
  createAdminUser,
  createTestUser,
} from "../helpers/factories";
import { OUTSIDE_LAGOS_DELIVERY_FEE_KOBO } from "@/modules/astore/astore.commerce";

const ORDERS = "/api/v1/orders";
const CART = "/api/v1/cart";
const ADMIN = "/api/v1/admin/astore";

const checkoutBody = {
  deliveryZone: "lagos" as const,
  shippingAddress: "12 Admiralty Way, Lagos",
};

describe("Orders API", () => {
  let userHeaders: { Authorization: string };
  let adminHeaders: { Authorization: string };
  let productId: string;
  let variantId: string;

  beforeEach(async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          checkout_id: "chk_test_123",
          checkout_url: "https://checkout.bachs.io/c/test",
          status: "open",
          reference: null,
        }),
      })
    );

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

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects checkout with empty cart", async () => {
    const res = await testApp
      .post(`${ORDERS}/checkout`)
      .set(userHeaders)
      .send(checkoutBody);
    expect(res.status).toBe(400);
  });

  it("checks out cart into order + Bachs checkout URL and clears cart", async () => {
    process.env.BACH_SECRET_KEY = "sk_sandbox_test";

    await testApp
      .post(`${CART}/items`)
      .set(userHeaders)
      .send({ productId, variantId, quantity: 2 });

    const res = await testApp
      .post(`${ORDERS}/checkout`)
      .set(userHeaders)
      .send(checkoutBody);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      status: "processing",
      subtotalKobo: 840000,
      shippingFeeKobo: 0,
      totalAmountKobo: 840000,
      deliveryZone: "lagos",
      shippingAddress: "12 Admiralty Way, Lagos",
      checkoutUrl: "https://checkout.bachs.io/c/test",
    });
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.payment).toMatchObject({
      status: "pending",
      amountKobo: 840000,
      provider: "bach",
      providerRef: "chk_test_123",
    });

    const cart = await testApp.get(CART).set(userHeaders);
    expect(cart.body.data.items).toHaveLength(0);

    const variant = await prisma.aStoreProductVariant.findUnique({
      where: { id: variantId },
    });
    expect(variant?.stockQty).toBe(3);

    expect(fetch).toHaveBeenCalled();
  });

  it("adds outside-Lagos delivery fee to total and payment", async () => {
    process.env.BACH_SECRET_KEY = "sk_sandbox_test";

    await testApp
      .post(`${CART}/items`)
      .set(userHeaders)
      .send({ productId, variantId, quantity: 1 });

    const res = await testApp
      .post(`${ORDERS}/checkout`)
      .set(userHeaders)
      .send({
        deliveryZone: "outside_lagos",
        shippingAddress: "15 Aba Road, Port Harcourt",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.subtotalKobo).toBe(420000);
    expect(res.body.data.shippingFeeKobo).toBe(OUTSIDE_LAGOS_DELIVERY_FEE_KOBO);
    expect(res.body.data.totalAmountKobo).toBe(
      420000 + OUTSIDE_LAGOS_DELIVERY_FEE_KOBO
    );
    expect(res.body.data.payment.amountKobo).toBe(
      420000 + OUTSIDE_LAGOS_DELIVERY_FEE_KOBO
    );
  });

  it("does not decrement stock for custom (MTO) products", async () => {
    process.env.BACH_SECRET_KEY = "sk_sandbox_test";

    const custom = await testApp
      .post(`${ADMIN}/products`)
      .set(adminHeaders)
      .send({
        name: "Custom Card",
        type: "custom",
        basePriceKobo: 700000,
      });

    await testApp
      .post(`${CART}/items`)
      .set(userHeaders)
      .send({
        productId: custom.body.data.id,
        quantity: 1,
        customUsername: "abio",
        preferredColor: "Gold",
      });

    const res = await testApp
      .post(`${ORDERS}/checkout`)
      .set(userHeaders)
      .send(checkoutBody);

    expect(res.status).toBe(201);
    expect(res.body.data.items[0].variantId).toBeNull();
    expect(res.body.data.subtotalKobo).toBe(700000);
  });

  it("snapshots product/variant fields onto order items", async () => {
    process.env.BACH_SECRET_KEY = "sk_sandbox_test";

    await testApp
      .post(`${CART}/items`)
      .set(userHeaders)
      .send({ productId, variantId, quantity: 1 });

    const res = await testApp
      .post(`${ORDERS}/checkout`)
      .set(userHeaders)
      .send(checkoutBody);

    expect(res.status).toBe(201);
    const line = res.body.data.items[0];
    expect(line.productName).toBe("Checkout Tee");
    expect(line.productSlug).toBeTruthy();
    expect(line.productType).toBe("standard");
    expect(line.variantColorName).toBe("White");
    expect(Array.isArray(line.imageUrls)).toBe(true);
  });

  it("lists and gets my orders", async () => {
    process.env.BACH_SECRET_KEY = "sk_sandbox_test";

    await testApp
      .post(`${CART}/items`)
      .set(userHeaders)
      .send({ productId, variantId, quantity: 1 });

    const placed = await testApp
      .post(`${ORDERS}/checkout`)
      .set(userHeaders)
      .send(checkoutBody);

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
      .send(checkoutBody);

    expect(res.status).toBe(409);
  });

  it("only one of two concurrent checkouts succeeds", async () => {
    process.env.BACH_SECRET_KEY = "sk_sandbox_test";

    await testApp
      .post(`${CART}/items`)
      .set(userHeaders)
      .send({ productId, variantId, quantity: 1 });

    const [a, b] = await Promise.all([
      testApp.post(`${ORDERS}/checkout`).set(userHeaders).send(checkoutBody),
      testApp.post(`${ORDERS}/checkout`).set(userHeaders).send(checkoutBody),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 400]);

    const orders = await prisma.aStoreOrder.findMany({
      where: { items: { some: { productId } } },
    });
    expect(orders).toHaveLength(1);
  });
});
