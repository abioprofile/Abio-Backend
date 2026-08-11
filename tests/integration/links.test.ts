import { describe, it, expect, beforeEach } from "vitest";
import { testApp } from "../helpers/testApp";
import { authHeader, createTestUser } from "../helpers/factories";

const LINKS = "/api/v1/links";

describe("Links API (legacy LinkController)", () => {
  let userId: string;
  let headers: { Authorization: string };

  beforeEach(async () => {
    const user = await createTestUser();
    userId = user.id;
    headers = authHeader(userId);
  });

  it("rejects unauthenticated requests", async () => {
    const res = await testApp.get(LINKS);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("create → list (ordered) → get by id → update → duplicate 409 → reorder → delete → 404, and blocks other users", async () => {
    // Create first link (known social URL → platform auto-detected)
    const create1 = await testApp
      .post(LINKS)
      .set(headers)
      .send({
        title: "GitHub",
        url: "https://github.com/abio-test",
      });

    expect(create1.status).toBe(201);
    expect(create1.body.success).toBe(true);
    expect(create1.body.data).toMatchObject({
      title: "GitHub",
      url: "https://github.com/abio-test",
      platform: "GITHUB",
      displayOrder: 0,
    });
    const link1Id = create1.body.data.id as string;

    // Create second link
    const create2 = await testApp
      .post(LINKS)
      .set(headers)
      .send({
        title: "Twitter",
        url: "https://twitter.com/abio-test",
      });

    expect(create2.status).toBe(201);
    expect(create2.body.data.platform).toBe("TWITTER");
    expect(create2.body.data.displayOrder).toBe(1);
    const link2Id = create2.body.data.id as string;

    // List ordered by displayOrder asc
    const list = await testApp.get(LINKS).set(headers);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(2);
    expect(list.body.data.map((l: { id: string }) => l.id)).toEqual([
      link1Id,
      link2Id,
    ]);

    // Get by id
    const getOne = await testApp.get(`${LINKS}/${link1Id}`).set(headers);
    expect(getOne.status).toBe(200);
    expect(getOne.body.data.id).toBe(link1Id);

    // Update
    const updated = await testApp
      .patch(`${LINKS}/${link1Id}`)
      .set(headers)
      .send({ title: "GitHub Profile" });

    expect(updated.status).toBe(200);
    expect(updated.body.data.title).toBe("GitHub Profile");

    // Duplicate URL → 409
    const duplicate = await testApp
      .post(LINKS)
      .set(headers)
      .send({
        title: "GitHub again",
        url: "https://github.com/abio-test",
      });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.success).toBe(false);
    expect(duplicate.body.message).toMatch(/already have a link/i);

    // Reorder: swap display orders
    const reorder = await testApp
      .patch(`${LINKS}/reorder/all`)
      .set(headers)
      .send({
        links: [
          { id: link1Id, displayOrder: 1 },
          { id: link2Id, displayOrder: 0 },
        ],
      });

    expect(reorder.status).toBe(200);
    expect(reorder.body.success).toBe(true);

    const listAfterReorder = await testApp.get(LINKS).set(headers);
    expect(listAfterReorder.body.data.map((l: { id: string }) => l.id)).toEqual(
      [link2Id, link1Id]
    );

    // Another user cannot access this link (current API: 404)
    const other = await createTestUser();
    const otherHeaders = authHeader(other.id);

    const foreignGet = await testApp
      .get(`${LINKS}/${link1Id}`)
      .set(otherHeaders);
    expect(foreignGet.status).toBe(404);

    const foreignUpdate = await testApp
      .patch(`${LINKS}/${link1Id}`)
      .set(otherHeaders)
      .send({ title: "Hijack" });
    expect(foreignUpdate.status).toBe(404);

    const foreignDelete = await testApp
      .delete(`${LINKS}/${link1Id}`)
      .set(otherHeaders);
    expect(foreignDelete.status).toBe(404);

    // Delete
    const deleted = await testApp.delete(`${LINKS}/${link1Id}`).set(headers);
    expect(deleted.status).toBe(200);
    expect(deleted.body.success).toBe(true);

    // 404 after delete
    const afterDelete = await testApp.get(`${LINKS}/${link1Id}`).set(headers);
    expect(afterDelete.status).toBe(404);
  });

  it("requires platform when URL is not a known social platform", async () => {
    const res = await testApp
      .post(LINKS)
      .set(headers)
      .send({
        title: "Personal",
        url: "https://example.com/me",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("creates a custom platform link when platform is provided", async () => {
    const res = await testApp
      .post(LINKS)
      .set(headers)
      .send({
        title: "Personal",
        url: "https://example.com/me",
        platform: "website",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.platform).toBe("website");
  });
});
