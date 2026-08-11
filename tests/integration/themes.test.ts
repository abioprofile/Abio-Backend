import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { testApp } from "../helpers/testApp";
import {
  authHeader,
  createAdminUser,
  createTestUser,
} from "../helpers/factories";

const THEMES = "/api/v1/themes";

const themePayload = (name: string) => ({
  name,
  font_config: {
    name: "Inter",
    fillColor: "#111111",
  },
  corner_config: {
    type: "round" as const,
    opacity: 1,
  },
  wallpaper_config: {
    type: "solid",
    backgroundColor: "#ffffff",
  },
});

describe("Themes API", () => {
  let userHeaders: { Authorization: string };
  let adminHeaders: { Authorization: string };

  beforeEach(async () => {
    const user = await createTestUser();
    const admin = await createAdminUser();
    userHeaders = authHeader(user.id);
    adminHeaders = authHeader(admin.id);
  });

  it("rejects unauthenticated list", async () => {
    const res = await testApp.get(THEMES);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("lists themes for an authenticated user", async () => {
    const suffix = `${Date.now()}`;
    await prisma.displayTheme.create({
      data: {
        name: `seed-theme-${suffix}`,
        font_config: { name: "Inter" },
        corner_config: { type: "sharp" },
        wallpaper_config: { type: "solid" },
      },
    });

    const res = await testApp.get(THEMES).set(userHeaders);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(
      res.body.data.some(
        (t: { name: string }) => t.name === `seed-theme-${suffix}`
      )
    ).toBe(true);
  });

  it("forbids non-admin from creating themes", async () => {
    const res = await testApp
      .post(THEMES)
      .set(userHeaders)
      .send(themePayload(`user-theme-${Date.now()}`));

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("allows admin to create a theme", async () => {
    const name = `admin-theme-${Date.now()}`;
    const res = await testApp
      .post(THEMES)
      .set(adminHeaders)
      .send(themePayload(name));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/theme created successfully/i);
    expect(res.body.data).toMatchObject({ name });
  });
});
