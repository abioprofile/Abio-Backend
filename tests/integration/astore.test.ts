import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { testApp } from "../helpers/testApp";
import {
  authHeader,
  createAdminUser,
  createTestUser,
} from "../helpers/factories";

const ASTORE = "/api/v1/admin/astore";

describe("Admin Astore API", () => {
  let userHeaders: { Authorization: string };
  let adminHeaders: { Authorization: string };
  let adminId: string;

  beforeEach(async () => {
    const user = await createTestUser();
    const admin = await createAdminUser({ name: "Astore Admin" });
    userHeaders = authHeader(user.id);
    adminHeaders = authHeader(admin.id);
    adminId = admin.id;
  });

  it("rejects normal user creating a product", async () => {
    const res = await testApp
      .post(`${ASTORE}/products`)
      .set(userHeaders)
      .send({
        name: "Tee",
        type: "standard",
        basePriceKobo: 500000,
      });
    expect(res.status).toBe(403);
  });

  it("creates a product with auto slug", async () => {
    const res = await testApp
      .post(`${ASTORE}/products`)
      .set(adminHeaders)
      .send({
        name: "Abio Tee",
        type: "standard",
        basePriceKobo: 750000,
        description: "Soft cotton tee",
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: "Abio Tee",
      slug: "abio-tee",
      type: "standard",
      basePriceKobo: 750000,
      active: true,
      currency: "NGN",
    });
    expect(res.body.data.variants).toEqual([]);

    const audit = await prisma.adminAuditLog.findFirst({
      where: {
        action: "astore.product.create",
        resourceId: res.body.data.id,
        adminId,
      },
    });
    expect(audit).toBeTruthy();
  });

  it("lists products and gets by id", async () => {
    const created = await testApp
      .post(`${ASTORE}/products`)
      .set(adminHeaders)
      .send({
        name: "Hoodie",
        type: "custom",
        basePriceKobo: 1200000,
      });

    const list = await testApp
      .get(`${ASTORE}/products`)
      .query({ page: "1", limit: "10" })
      .set(adminHeaders);

    expect(list.status).toBe(200);
    expect(list.body.data.products.length).toBeGreaterThanOrEqual(1);
    expect(list.body.data.pagination.total).toBeGreaterThanOrEqual(1);

    const detail = await testApp
      .get(`${ASTORE}/products/${created.body.data.id}`)
      .set(adminHeaders);

    expect(detail.status).toBe(200);
    expect(detail.body.data.name).toBe("Hoodie");
  });

  it("soft-hides a product via active=false", async () => {
    const created = await testApp
      .post(`${ASTORE}/products`)
      .set(adminHeaders)
      .send({
        name: "Cap",
        type: "standard",
        basePriceKobo: 300000,
      });

    const res = await testApp
      .patch(`${ASTORE}/products/${created.body.data.id}`)
      .set(adminHeaders)
      .send({ active: false });

    expect(res.status).toBe(200);
    expect(res.body.data.active).toBe(false);

    const inactive = await testApp
      .get(`${ASTORE}/products`)
      .query({ active: "false" })
      .set(adminHeaders);

    expect(
      inactive.body.data.products.some(
        (p: { id: string }) => p.id === created.body.data.id
      )
    ).toBe(true);
  });

  it("creates and updates a variant", async () => {
    const product = await testApp
      .post(`${ASTORE}/products`)
      .set(adminHeaders)
      .send({
        name: "Variant Tee",
        type: "standard",
        basePriceKobo: 500000,
      });

    const productId = product.body.data.id as string;

    const created = await testApp
      .post(`${ASTORE}/products/${productId}/variants`)
      .set(adminHeaders)
      .send({
        colorName: "Black",
        colorHex: "#000000",
        stockQty: 10,
        priceKobo: 520000,
        imageUrls: ["https://cdn.example.com/black.png"],
      });

    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      colorName: "Black",
      stockQty: 10,
      priceKobo: 520000,
      active: true,
    });

    const updated = await testApp
      .patch(
        `${ASTORE}/products/${productId}/variants/${created.body.data.id}`
      )
      .set(adminHeaders)
      .send({ stockQty: 3, active: false });

    expect(updated.status).toBe(200);
    expect(updated.body.data.stockQty).toBe(3);
    expect(updated.body.data.active).toBe(false);

    const detail = await testApp
      .get(`${ASTORE}/products/${productId}`)
      .set(adminHeaders);
    expect(detail.body.data.variants).toHaveLength(1);
  });

  it("rejects duplicate color variant on same product", async () => {
    const product = await testApp
      .post(`${ASTORE}/products`)
      .set(adminHeaders)
      .send({
        name: "Dup Color Tee",
        type: "standard",
        basePriceKobo: 500000,
      });

    const productId = product.body.data.id as string;

    await testApp
      .post(`${ASTORE}/products/${productId}/variants`)
      .set(adminHeaders)
      .send({ colorName: "Red", stockQty: 1 });

    const dup = await testApp
      .post(`${ASTORE}/products/${productId}/variants`)
      .set(adminHeaders)
      .send({ colorName: "Red", stockQty: 2 });

    expect(dup.status).toBe(409);
  });

  it("updates product slug and imageUrls", async () => {
    const created = await testApp
      .post(`${ASTORE}/products`)
      .set(adminHeaders)
      .send({
        name: "Slug Edit Tee",
        type: "standard",
        basePriceKobo: 100000,
        imageUrls: ["https://cdn.example.com/p1.png"],
      });

    expect(created.status).toBe(201);
    expect(created.body.data.imageUrls).toEqual([
      "https://cdn.example.com/p1.png",
    ]);

    const updated = await testApp
      .patch(`${ASTORE}/products/${created.body.data.id}`)
      .set(adminHeaders)
      .send({
        slug: "slug-edit-tee-v2",
        imageUrls: [
          "https://cdn.example.com/p1.png",
          "https://cdn.example.com/p2.png",
        ],
      });

    expect(updated.status).toBe(200);
    expect(updated.body.data.slug).toBe("slug-edit-tee-v2");
    expect(updated.body.data.imageUrls).toHaveLength(2);
  });
});
