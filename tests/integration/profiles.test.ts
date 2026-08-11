import { describe, it, expect, vi, beforeEach } from "vitest";
import { testApp } from "../helpers/testApp";
import { authHeader, createTestUser } from "../helpers/factories";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/cache", () => ({
  default: {
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
  },
}));

const USER = "/api/v1/user";

describe("Profiles API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gets my profile when authenticated", async () => {
    const user = await createTestUser();
    const res = await testApp.get(`${USER}/profile`).set(authHeader(user.id));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(user.profile!.id);
  });

  it("updates profile fields", async () => {
    const user = await createTestUser();
    const username = `u_${Date.now().toString(36)}`;

    const res = await testApp
      .patch(`${USER}/profile`)
      .set(authHeader(user.id))
      .send({
        username,
        bio: "Hello Abio",
        location: "Lagos",
        goals: ["Ship more"],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.username).toBe(username);
    expect(res.body.data.bio).toBe("Hello Abio");
  });

  it("checks username availability", async () => {
    const taken = `taken_${Date.now().toString(36)}`;
    const user = await createTestUser();
    await prisma.profile.update({
      where: { userId: user.id },
      data: { username: taken },
    });

    const unavailable = await testApp.get(
      `${USER}/check-username?username=${taken}`
    );
    expect(unavailable.status).toBe(200);
    expect(unavailable.body.data.isAvailable).toBe(false);

    const available = await testApp.get(
      `${USER}/check-username?username=free_${Date.now().toString(36)}`
    );
    expect(available.status).toBe(200);
    expect(available.body.data.isAvailable).toBe(true);
  });

  it("returns a public profile by username", async () => {
    const username = `pub_${Date.now().toString(36)}`;
    const user = await createTestUser();
    await prisma.profile.update({
      where: { userId: user.id },
      data: { username, isPublic: true, bio: "Public bio" },
    });

    const res = await testApp.get(`${USER}/${username}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.username).toBe(username);
    expect(res.body.data.bio).toBe("Public bio");
  });

  it("404s for missing or private public profiles", async () => {
    const missing = await testApp.get(`${USER}/no_such_user_zzz`);
    expect(missing.status).toBe(404);

    const username = `priv_${Date.now().toString(36)}`;
    const user = await createTestUser();
    await prisma.profile.update({
      where: { userId: user.id },
      data: { username, isPublic: false },
    });

    const priv = await testApp.get(`${USER}/${username}`);
    expect(priv.status).toBe(404);
  });
});
