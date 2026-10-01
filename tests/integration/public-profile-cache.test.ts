import { describe, it, expect, vi, beforeEach } from "vitest";
import { testApp } from "../helpers/testApp";
import { authHeader, createTestUser } from "../helpers/factories";
import { prisma } from "@/lib/prisma";
import cache from "@/lib/cache";

vi.mock("@/lib/cache", () => ({
  default: {
    get: vi.fn().mockResolvedValue(null),
    mget: vi.fn().mockResolvedValue([null, null]),
    setex: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    incr: vi.fn().mockResolvedValue(1),
  },
}));

vi.mock("@/shared/utils/cloudinary", () => ({
  uploadToCloudinary: vi.fn().mockResolvedValue({
    url: "https://cdn.example.com/icon_urls/test.webp",
    publicId: "icon_urls/test",
  }),
  deleteFromCloudinary: vi.fn().mockResolvedValue(undefined),
}));

const LINKS = "/api/v1/links";
const USER = "/api/v1/user";

const keyFor = (username: string | null | undefined) =>
  `public_profiles:${username}`;

const createLink = (profileId: string, url: string, displayOrder = 0) =>
  prisma.link.create({
    data: { title: "Site", url, displayOrder, profileId },
  });

describe("Public profile cache invalidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("busts the cache when a link is created", async () => {
    const user = await createTestUser();

    const res = await testApp
      .post(LINKS)
      .set(authHeader(user.id))
      .send({ title: "GitHub", url: "https://github.com/abio-cache-create" });

    expect(res.status).toBe(201);
    expect(cache.del).toHaveBeenCalledWith(keyFor(user.profile!.username));
  });

  it("busts the cache when a link is updated", async () => {
    const user = await createTestUser();
    const link = await createLink(
      user.profile!.id,
      "https://example.com/cache-update"
    );

    const res = await testApp
      .patch(`${LINKS}/${link.id}`)
      .set(authHeader(user.id))
      .send({ isVisible: false });

    expect(res.status).toBe(200);
    expect(cache.del).toHaveBeenCalledWith(keyFor(user.profile!.username));
  });

  it("busts the cache when a link is deleted", async () => {
    const user = await createTestUser();
    const link = await createLink(
      user.profile!.id,
      "https://example.com/cache-delete"
    );

    const res = await testApp
      .delete(`${LINKS}/${link.id}`)
      .set(authHeader(user.id));

    expect(res.status).toBe(200);
    expect(cache.del).toHaveBeenCalledWith(keyFor(user.profile!.username));
  });

  it("busts the cache when links are reordered", async () => {
    const user = await createTestUser();
    const a = await createLink(user.profile!.id, "https://example.com/a", 0);
    const b = await createLink(user.profile!.id, "https://example.com/b", 1);

    const res = await testApp
      .patch(`${LINKS}/reorder/all`)
      .set(authHeader(user.id))
      .send({
        links: [
          { id: a.id, displayOrder: 1 },
          { id: b.id, displayOrder: 0 },
        ],
      });

    expect(res.status).toBe(200);
    expect(cache.del).toHaveBeenCalledWith(keyFor(user.profile!.username));
  });

  it("busts the cache when a link icon is updated", async () => {
    const user = await createTestUser();
    const link = await createLink(
      user.profile!.id,
      "https://example.com/cache-icon"
    );

    const res = await testApp
      .patch(`${LINKS}/${link.id}/icon`)
      .set(authHeader(user.id))
      .attach("icon", Buffer.from("fake-image"), {
        filename: "icon.png",
        contentType: "image/png",
      });

    expect(res.status).toBe(200);
    expect(cache.del).toHaveBeenCalledWith(keyFor(user.profile!.username));
  });

  it("rejects updating the icon of another user's link", async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    const link = await createLink(
      owner.profile!.id,
      "https://example.com/cache-icon-owner"
    );

    const res = await testApp
      .patch(`${LINKS}/${link.id}/icon`)
      .set(authHeader(other.id))
      .attach("icon", Buffer.from("fake-image"), {
        filename: "icon.png",
        contentType: "image/png",
      });

    expect(res.status).toBe(404);
    const unchanged = await prisma.link.findUnique({ where: { id: link.id } });
    expect(unchanged?.icon_link).toBeNull();
  });

  it("busts both old and new username caches on profile update", async () => {
    const user = await createTestUser();
    const oldUsername = user.profile!.username;
    const newUsername = `renamed_${Date.now().toString(36)}`;

    const res = await testApp
      .patch(`${USER}/profile`)
      .set(authHeader(user.id))
      .send({ username: newUsername, bio: "New bio" });

    expect(res.status).toBe(200);
    expect(cache.del).toHaveBeenCalledWith(keyFor(oldUsername));
    expect(cache.del).toHaveBeenCalledWith(keyFor(newUsername));
  });

  it("busts the cache when the account is deleted", async () => {
    const user = await createTestUser({ password: "Password123!" });

    const res = await testApp
      .delete(USER)
      .set(authHeader(user.id))
      .send({ password: "Password123!" });

    expect(res.status).toBe(200);
    expect(cache.del).toHaveBeenCalledWith(keyFor(user.profile!.username));
  });

  it("bumps the version key on bust", async () => {
    const user = await createTestUser();
    const link = await createLink(
      user.profile!.id,
      "https://example.com/cache-version"
    );

    await testApp
      .patch(`${LINKS}/${link.id}`)
      .set(authHeader(user.id))
      .send({ title: "Renamed" });

    expect(cache.incr).toHaveBeenCalledWith(
      `public_profiles_version:${user.profile!.username}`
    );
  });

  it("tags the written entry with the version read before the DB query", async () => {
    const user = await createTestUser();
    vi.mocked(cache.mget).mockResolvedValueOnce([null, "3"]);

    const res = await testApp.get(`${USER}/${user.profile!.username}`);

    expect(res.status).toBe(200);
    const [key, , value] = vi.mocked(cache.setex).mock.calls[0];
    expect(key).toBe(keyFor(user.profile!.username));
    expect(JSON.parse(value as string).v).toBe("3");
  });

  it("ignores an entry written from pre-update data after a bust", async () => {
    const user = await createTestUser();
    await prisma.profile.update({
      where: { userId: user.id },
      data: { bio: "Fresh bio" },
    });

    // A slow reader cached old data under version 0; a bust then moved it to 1
    vi.mocked(cache.mget).mockResolvedValueOnce([
      JSON.stringify({ v: "0", data: { bio: "Stale bio" } }),
      "1",
    ]);

    const res = await testApp.get(`${USER}/${user.profile!.username}`);

    expect(res.status).toBe(200);
    expect(res.body.data.bio).toBe("Fresh bio");
  });

  it("ignores legacy untagged entries", async () => {
    const user = await createTestUser();
    await prisma.profile.update({
      where: { userId: user.id },
      data: { bio: "Fresh bio" },
    });

    vi.mocked(cache.mget).mockResolvedValueOnce([
      JSON.stringify({ bio: "Legacy bio" }),
      null,
    ]);

    const res = await testApp.get(`${USER}/${user.profile!.username}`);

    expect(res.status).toBe(200);
    expect(res.body.data.bio).toBe("Fresh bio");
  });
});
