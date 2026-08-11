import { describe, it, expect, vi, beforeEach } from "vitest";
import { testApp } from "../helpers/testApp";
import { authHeader, createTestUser } from "../helpers/factories";
import { prisma } from "@/lib/prisma";
import cache from "@/lib/cache";

vi.mock("@/lib/cache", () => ({
  default: {
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
  },
}));

const PUBLIC = "/api/v1/public";
const LINKS = "/api/v1/links";
const USER = "/api/v1/user";

describe("Public API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tracks a link click without auth and increments clickCount", async () => {
    const user = await createTestUser();
    const link = await prisma.link.create({
      data: {
        title: "GitHub",
        url: "https://github.com/abio-public-click",
        platform: "GITHUB",
        displayOrder: 0,
        profileId: user.profile!.id,
        clickCount: 0,
      },
    });

    const res = await testApp.post(`${PUBLIC}/links/${link.id}/click`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Click tracked");

    const updated = await prisma.link.findUnique({ where: { id: link.id } });
    expect(updated?.clickCount).toBe(1);
    expect(cache.del).toHaveBeenCalledWith(
      `public_profiles:${user.profile!.username}`
    );
  });

  it("surfaces clickCount on the authenticated link list after clicks", async () => {
    const user = await createTestUser();
    const headers = authHeader(user.id);

    const created = await testApp
      .post(LINKS)
      .set(headers)
      .send({
        title: "GitHub",
        url: "https://github.com/abio-clickcount-list",
      });

    expect(created.status).toBe(201);
    expect(created.body.data.clickCount).toBe(0);
    const linkId = created.body.data.id as string;

    await testApp.post(`${PUBLIC}/links/${linkId}/click`);
    await testApp.post(`${PUBLIC}/links/${linkId}/click`);

    const list = await testApp.get(LINKS).set(headers);
    expect(list.status).toBe(200);
    const listed = list.body.data.find((l: { id: string }) => l.id === linkId);
    expect(listed.clickCount).toBe(2);

    const one = await testApp.get(`${LINKS}/${linkId}`).set(headers);
    expect(one.body.data.clickCount).toBe(2);
  });

  it("refreshes public profile clickCount after cache bust on click", async () => {
    const username = `pub_click_${Date.now().toString(36)}`;
    const user = await createTestUser();
    await prisma.profile.update({
      where: { userId: user.id },
      data: { username, isPublic: true },
    });

    const link = await prisma.link.create({
      data: {
        title: "Site",
        url: "https://example.com/public-click-bust",
        platform: "website",
        displayOrder: 0,
        profileId: user.profile!.id,
        isVisible: true,
        clickCount: 0,
      },
    });

    const before = await testApp.get(`${USER}/${username}`);
    expect(before.status).toBe(200);
    expect(before.body.data.links[0].clickCount).toBe(0);

    // Simulate a warm cache with the stale payload from the first fetch
    vi.mocked(cache.get).mockResolvedValueOnce(JSON.stringify(before.body.data));

    const stale = await testApp.get(`${USER}/${username}`);
    expect(stale.body.data.links[0].clickCount).toBe(0);

    await testApp.post(`${PUBLIC}/links/${link.id}/click`);
    expect(cache.del).toHaveBeenCalledWith(`public_profiles:${username}`);

    // Cache miss after bust → DB has incremented count
    vi.mocked(cache.get).mockResolvedValueOnce(null);

    const after = await testApp.get(`${USER}/${username}`);
    expect(after.status).toBe(200);
    expect(after.body.data.links[0].clickCount).toBe(1);
  });

  it("returns 404 for an unknown link id", async () => {
    const res = await testApp.post(
      `${PUBLIC}/links/00000000-0000-4000-8000-000000000000/click`
    );

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("returns 400 for an invalid link id", async () => {
    const res = await testApp.post(`${PUBLIC}/links/not-a-uuid/click`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
