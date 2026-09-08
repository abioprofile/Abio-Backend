import { describe, it, expect, beforeEach } from "vitest";
import { testApp } from "../helpers/testApp";
import { authHeader, createAdminUser } from "../helpers/factories";

const PUBLIC = "/api/v1/astore";
const ADMIN = "/api/v1/admin/astore";

describe("Public Astore catalog", () => {
  let adminHeaders: { Authorization: string };
  let activeId: string;
  let activeSlug: string;
  let inactiveId: string;

  beforeEach(async () => {
    const admin = await createAdminUser({ name: "Catalog Admin" });
    adminHeaders = authHeader(admin.id);

    const active = await testApp
      .post(`${ADMIN}/products`)
      .set(adminHeaders)
      .send({
        name: "Public Hoodie",
        type: "standard",
        basePriceKobo: 900000,
        description: "Cozy public hoodie",
      });
    activeId = active.body.data.id;
    activeSlug = active.body.data.slug;

    await testApp
      .post(`${ADMIN}/products/${activeId}/variants`)
      .set(adminHeaders)
      .send({ colorName: "Grey", stockQty: 4, priceKobo: 950000 });

    const inactiveVariant = await testApp
      .post(`${ADMIN}/products/${activeId}/variants`)
      .set(adminHeaders)
      .send({ colorName: "Hidden", stockQty: 1 });

    await testApp
      .patch(
        `${ADMIN}/products/${activeId}/variants/${inactiveVariant.body.data.id}`
      )
      .set(adminHeaders)
      .send({ active: false });

    const hidden = await testApp
      .post(`${ADMIN}/products`)
      .set(adminHeaders)
      .send({
        name: "Secret Drop",
        type: "custom",
        basePriceKobo: 100000,
        active: false,
      });
    inactiveId = hidden.body.data.id;
  });

  it("lists active products without auth", async () => {
    const res = await testApp.get(`${PUBLIC}/products`);

    expect(res.status).toBe(200);
    expect(
      res.body.data.products.every((p: { active?: boolean }) => p.active === undefined)
    ).toBe(true);
    expect(
      res.body.data.products.some((p: { id: string }) => p.id === activeId)
    ).toBe(true);
    expect(
      res.body.data.products.some((p: { id: string }) => p.id === inactiveId)
    ).toBe(false);
  });

  it("filters by q and type", async () => {
    const byQ = await testApp
      .get(`${PUBLIC}/products`)
      .query({ q: "Hoodie" });
    expect(byQ.status).toBe(200);
    expect(
      byQ.body.data.products.some((p: { name: string }) =>
        p.name.includes("Hoodie")
      )
    ).toBe(true);

    const byType = await testApp
      .get(`${PUBLIC}/products`)
      .query({ type: "standard" });
    expect(byType.status).toBe(200);
    expect(
      byType.body.data.products.every(
        (p: { type: string }) => p.type === "standard"
      )
    ).toBe(true);
  });

  it("gets product by id and by slug with only active variants", async () => {
    const byId = await testApp.get(`${PUBLIC}/products/${activeId}`);
    expect(byId.status).toBe(200);
    expect(byId.body.data.name).toBe("Public Hoodie");
    expect(byId.body.data.variants).toHaveLength(1);
    expect(byId.body.data.variants[0].colorName).toBe("Grey");

    const bySlug = await testApp.get(`${PUBLIC}/products/${activeSlug}`);
    expect(bySlug.status).toBe(200);
    expect(bySlug.body.data.id).toBe(activeId);
  });

  it("returns 404 for inactive product", async () => {
    const res = await testApp.get(`${PUBLIC}/products/${inactiveId}`);
    expect(res.status).toBe(404);
  });
});
