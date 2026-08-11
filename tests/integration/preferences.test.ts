import { describe, it, expect, vi, beforeEach } from "vitest";
import { testApp } from "../helpers/testApp";
import { authHeader, createTestUser } from "../helpers/factories";

vi.mock("@/lib/cache", () => ({
  default: {
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
  },
}));

const USER = "/api/v1/user";

describe("Preferences API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gets (or generates) display preferences", async () => {
    const user = await createTestUser();
    const res = await testApp
      .get(`${USER}/preferences`)
      .set(authHeader(user.id));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeTruthy();
    expect(res.body.data.userId).toBe(user.id);
  });

  it("updates font preferences", async () => {
    const user = await createTestUser();
    const res = await testApp
      .put(`${USER}/preferences/fonts`)
      .set(authHeader(user.id))
      .send({
        name: "Inter",
        fillColor: "#111111",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.font_config).toMatchObject({
      name: "Inter",
      fillColor: "#111111",
    });
  });

  it("updates corner preferences", async () => {
    const user = await createTestUser();
    const res = await testApp
      .put(`${USER}/preferences/corners`)
      .set(authHeader(user.id))
      .send({
        type: "round",
        opacity: 0.8,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.corner_config).toMatchObject({
      type: "round",
      opacity: 0.8,
    });
  });

  it("updates solid background preferences", async () => {
    const user = await createTestUser();
    const res = await testApp
      .put(`${USER}/preferences/background`)
      .set(authHeader(user.id))
      .send({
        type: "solid",
        backgroundColor: "#abcdef",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.wallpaper_config).toMatchObject({
      type: "solid",
      backgroundColor: "#abcdef",
    });
  });

  it("updates all preferences in one request", async () => {
    const user = await createTestUser();
    const res = await testApp
      .put(`${USER}/preferences`)
      .set(authHeader(user.id))
      .send({
        font_config: { name: "Satoshi" },
        corner_config: { type: "curved" },
        wallpaper_config: { type: "solid", backgroundColor: "#000000" },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.font_config).toMatchObject({ name: "Satoshi" });
    expect(res.body.data.corner_config).toMatchObject({ type: "curved" });
  });
});
