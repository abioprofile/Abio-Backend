import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { testApp } from "../helpers/testApp";
import {
  authHeader,
  createAdminUser,
  createTestUser,
} from "../helpers/factories";

const CART = "/api/v1/cart";
const ASTORE = "/api/v1/admin/astore";

describe("Cart API", () => {
  let userHeaders: { Authorization: string };
  let adminHeaders: { Authorization: string };
  let productId: string;
  let variantId: string;

  beforeEach(async () => {
    const user = await createTestUser();
    const admin = await createAdminUser({ name: "Cart Admin" });
    userHeaders = authHeader(user.id);
    adminHeaders = authHeader(admin.id);

    const product = await testApp
      .post(`${ASTORE}/products`)
      .set(adminHeaders)
      .send({
        name: "Cart Tee",
        type: "standard",
        basePriceKobo: 500000,
      });
    productId = product.body.data.id;

    const variant = await testApp
      .post(`${ASTORE}/products/${productId}/variants`)
      .set(adminHeaders)
      .send({
        colorName: "Navy",
        stockQty: 5,
        priceKobo: 550000,
      });
    variantId = variant.body.data.id;
  });

  it("rejects unauthenticated cart access", async () => {
    const res = await testApp.get(CART);
    expect(res.status).toBe(401);
  });

  it("returns an empty cart for a new user", async () => {
    const res = await testApp.get(CART).set(userHeaders);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.itemCount).toBe(0);
    expect(res.body.data.subtotalKobo).toBe(0);
  });

  it("adds an item and merges quantity on second add", async () => {
    const first = await testApp
      .post(`${CART}/items`)
      .set(userHeaders)
      .send({ productId, variantId, quantity: 1 });

    expect(first.status).toBe(201);
    expect(first.body.data.items).toHaveLength(1);
    expect(first.body.data.items[0].unitPriceKobo).toBe(550000);
    expect(first.body.data.subtotalKobo).toBe(550000);

    const second = await testApp
      .post(`${CART}/items`)
      .set(userHeaders)
      .send({ productId, variantId, quantity: 2 });

    expect(second.status).toBe(201);
    expect(second.body.data.items).toHaveLength(1);
    expect(second.body.data.items[0].quantity).toBe(3);
    expect(second.body.data.subtotalKobo).toBe(550000 * 3);
  });

  it("updates and removes a cart item", async () => {
    const added = await testApp
      .post(`${CART}/items`)
      .set(userHeaders)
      .send({ productId, variantId, quantity: 2 });

    const itemId = added.body.data.items[0].id as string;

    const updated = await testApp
      .patch(`${CART}/items/${itemId}`)
      .set(userHeaders)
      .send({ quantity: 1 });

    expect(updated.status).toBe(200);
    expect(updated.body.data.items[0].quantity).toBe(1);

    const removed = await testApp
      .delete(`${CART}/items/${itemId}`)
      .set(userHeaders);

    expect(removed.status).toBe(200);
    expect(removed.body.data.items).toHaveLength(0);
  });

  it("clears the cart", async () => {
    await testApp
      .post(`${CART}/items`)
      .set(userHeaders)
      .send({ productId, variantId, quantity: 1 });

    const res = await testApp.delete(CART).set(userHeaders);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);

    const rows = await prisma.cartItem.count();
    expect(rows).toBe(0);
  });

  it("rejects inactive product", async () => {
    await testApp
      .patch(`${ASTORE}/products/${productId}`)
      .set(adminHeaders)
      .send({ active: false });

    const res = await testApp
      .post(`${CART}/items`)
      .set(userHeaders)
      .send({ productId, variantId, quantity: 1 });

    expect(res.status).toBe(404);
  });
});
