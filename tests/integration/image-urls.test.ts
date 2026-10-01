import { describe, it, expect, vi, beforeEach } from "vitest";
import { testApp } from "../helpers/testApp";
import {
  authHeader,
  cloudinaryTestUrl,
  createAdminUser,
  createTestUser,
} from "../helpers/factories";
import { prisma } from "@/lib/prisma";
import {
  deleteFromCloudinary,
  uploadToCloudinary,
} from "@/shared/utils/cloudinary";

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
  uploadToCloudinary: vi.fn(),
  deleteFromCloudinary: vi.fn().mockResolvedValue(undefined),
}));

const THEMES = "/api/v1/themes";
const USER = "/api/v1/user";
const ASTORE = "/api/v1/admin/astore";
const CART = "/api/v1/cart";

const EXTERNAL = "https://images.unsplash.com/photo-123.jpg";
const UPLOADED = cloudinaryTestUrl("v1/wallpapers/theme.webp");

const fontConfig = { name: "Inter" };
const cornerConfig = { type: "round", opacity: 1 };

describe("Image URLs must come from our Cloudinary", () => {
  let adminHeaders: { Authorization: string };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(uploadToCloudinary).mockResolvedValue({
      url: UPLOADED,
      publicId: "wallpapers/theme",
    });
    const admin = await createAdminUser();
    adminHeaders = authHeader(admin.id);
  });

  describe("themes", () => {
    it("rejects an external wallpaper URL", async () => {
      const res = await testApp
        .post(THEMES)
        .set(adminHeaders)
        .send({
          name: `external-${Date.now()}`,
          font_config: fontConfig,
          corner_config: cornerConfig,
          wallpaper_config: { type: "image", image: EXTERNAL },
        });

      expect(res.status).toBe(400);
    });

    it("uploads the attached wallpaper on create and stores the Cloudinary URL", async () => {
      const name = `upload-${Date.now()}`;
      const res = await testApp
        .post(THEMES)
        .set(adminHeaders)
        .field("name", name)
        .field("font_config", JSON.stringify(fontConfig))
        .field("corner_config", JSON.stringify(cornerConfig))
        .field("wallpaper_config", JSON.stringify({ type: "image" }))
        .attach("wallpaper_config[image]", Buffer.from("fake-image"), {
          filename: "bg.png",
          contentType: "image/png",
        });

      expect(res.status).toBe(200);
      expect(uploadToCloudinary).toHaveBeenCalledWith(
        expect.any(Buffer),
        "wallpapers",
        "image/png"
      );
      const saved = await prisma.displayTheme.findUnique({ where: { name } });
      expect(saved?.wallpaper_config).toMatchObject({
        type: "image",
        image: UPLOADED,
      });
    });

    it("uploads the attached wallpaper on update", async () => {
      const theme = await prisma.displayTheme.create({
        data: {
          name: `patch-${Date.now()}`,
          font_config: fontConfig,
          corner_config: cornerConfig,
          wallpaper_config: { type: "fill", backgroundColor: "#ffffff" },
        },
      });

      const res = await testApp
        .patch(`${THEMES}/${theme.id}`)
        .set(adminHeaders)
        .attach("wallpaper_config[image]", Buffer.from("fake-image"), {
          filename: "bg.png",
          contentType: "image/png",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.wallpaper_config).toMatchObject({
        type: "image",
        image: UPLOADED,
      });
    });

    it("removes the uploaded wallpaper when the request is invalid", async () => {
      const res = await testApp
        .post(THEMES)
        .set(adminHeaders)
        .field("name", "")
        .field("font_config", JSON.stringify(fontConfig))
        .field("corner_config", JSON.stringify(cornerConfig))
        .attach("wallpaper_config[image]", Buffer.from("fake-image"), {
          filename: "bg.png",
          contentType: "image/png",
        });

      expect(res.status).toBe(400);
      expect(deleteFromCloudinary).toHaveBeenCalledWith(UPLOADED);
    });
  });

  it("rejects an external wallpaper on user preferences", async () => {
    const user = await createTestUser();
    const res = await testApp
      .put(`${USER}/preferences`)
      .set(authHeader(user.id))
      .send({ wallpaper_config: { type: "image", image: EXTERNAL } });

    expect(res.status).toBe(400);
  });

  it("accepts a Cloudinary wallpaper on user preferences", async () => {
    const user = await createTestUser();
    const res = await testApp
      .put(`${USER}/preferences`)
      .set(authHeader(user.id))
      .send({ wallpaper_config: { type: "image", image: UPLOADED } });

    expect(res.status).toBe(200);
  });

  it("rejects an external avatarUrl on profile update", async () => {
    const user = await createTestUser();
    const res = await testApp
      .patch(`${USER}/profile`)
      .set(authHeader(user.id))
      .send({ avatarUrl: EXTERNAL });

    expect(res.status).toBe(400);
  });

  it("rejects external product, variant and overlay images", async () => {
    const product = await testApp
      .post(`${ASTORE}/products`)
      .set(adminHeaders)
      .send({
        name: "External Tee",
        type: "standard",
        basePriceKobo: 100000,
        imageUrls: [EXTERNAL],
      });
    expect(product.status).toBe(400);

    const overlay = await testApp
      .post(`${ASTORE}/products`)
      .set(adminHeaders)
      .send({
        name: "Overlay Tee",
        type: "standard",
        basePriceKobo: 100000,
        metadata: { preview: { enabled: true, frontOverlayUrl: EXTERNAL } },
      });
    expect(overlay.status).toBe(400);

    const created = await testApp
      .post(`${ASTORE}/products`)
      .set(adminHeaders)
      .send({
        name: `Variant Tee ${Date.now()}`,
        type: "standard",
        basePriceKobo: 100000,
      });
    expect(created.status).toBe(201);

    const variant = await testApp
      .post(`${ASTORE}/products/${created.body.data.id}/variants`)
      .set(adminHeaders)
      .send({ colorName: "Black", imageUrls: [EXTERNAL] });
    expect(variant.status).toBe(400);
  });

  it("rejects an external artworkUrl on cart items", async () => {
    const user = await createTestUser();
    const res = await testApp
      .post(`${CART}/items`)
      .set(authHeader(user.id))
      .send({
        productId: "00000000-0000-4000-8000-000000000000",
        artworkUrl: EXTERNAL,
      });

    expect(res.status).toBe(400);
  });
});
