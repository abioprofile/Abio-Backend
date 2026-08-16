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

vi.mock("@/shared/utils/cloudinary", () => ({
  uploadToCloudinary: vi.fn().mockResolvedValue({
    url: "https://cdn.example.com/wallpapers/test.webp",
    publicId: "wallpapers/test",
  }),
  deleteFromCloudinary: vi.fn().mockResolvedValue(undefined),
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

  it("updates all appearance prefs in one Save Changes request", async () => {
    const user = await createTestUser();
    const res = await testApp
      .put(`${USER}/preferences`)
      .set(authHeader(user.id))
      .send({
        font_config: {
          name: "Poppins",
          fillColor: "#000000",
          weight: "regular",
          italic: false,
          underline: false,
        },
        corner_config: {
          type: "round",
          fillColor: "#ffffff",
          opacity: 0.4,
          shadow: "hard",
        },
        wallpaper_config: {
          type: "fill",
          backgroundColor: "#0a0a0a",
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.font_config).toMatchObject({
      name: "Poppins",
      fillColor: "#000000",
      weight: "regular",
    });
    expect(res.body.data.corner_config).toMatchObject({
      type: "round",
      shadow: "hard",
    });
    expect(res.body.data.wallpaper_config).toMatchObject({
      type: "fill",
      backgroundColor: "#0a0a0a",
    });
  });

  it("accepts solid as alias of fill for wallpaper", async () => {
    const user = await createTestUser();
    const res = await testApp
      .put(`${USER}/preferences`)
      .set(authHeader(user.id))
      .send({
        wallpaper_config: {
          type: "solid",
          backgroundColor: "#abcdef",
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.data.wallpaper_config).toMatchObject({
      type: "fill",
      backgroundColor: "#abcdef",
    });
  });

  it("uploads a wallpaper image and returns a URL", async () => {
    const user = await createTestUser();
    const res = await testApp
      .post(`${USER}/preferences/wallpaper/image`)
      .set(authHeader(user.id))
      .attach("image", Buffer.from("fake-image"), {
        filename: "bg.png",
        contentType: "image/png",
      });

    expect(res.status).toBe(200);
    expect(res.body.data.url).toContain("cdn.example.com");
  });

  it("rejects empty preferences body", async () => {
    const user = await createTestUser();
    const res = await testApp
      .put(`${USER}/preferences`)
      .set(authHeader(user.id))
      .send({});

    expect(res.status).toBe(400);
  });
});
