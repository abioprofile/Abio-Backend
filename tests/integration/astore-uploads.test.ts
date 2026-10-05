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

vi.mock("@/shared/utils/cloudinary", () => ({
  uploadToCloudinary: vi.fn(),
  deleteFromCloudinary: vi.fn().mockResolvedValue(undefined),
}));

const ASTORE = "/api/v1/admin/astore";
const image = () => Buffer.from("fake-image");
const png = { filename: "a.png", contentType: "image/png" };

describe("Admin AStore uploads", () => {
  let adminHeaders: { Authorization: string };
  let uploads = 0;

  const createProduct = async (imageUrls: string[] = []) => {
    const res = await testApp
      .post(`${ASTORE}/products`)
      .set(adminHeaders)
      .send({
        name: `Upload Tee ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: "standard",
        basePriceKobo: 100000,
        imageUrls,
      });
    expect(res.status).toBe(201);
    return res.body.data as { id: string; imageUrls: string[] };
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    uploads = 0;
    vi.mocked(uploadToCloudinary).mockImplementation(async () => {
      uploads += 1;
      return {
        url: cloudinaryTestUrl(`v1/astore-products/upload-${uploads}.webp`),
        publicId: `astore-products/upload-${uploads}`,
      };
    });
    const admin = await createAdminUser();
    adminHeaders = authHeader(admin.id);
  });

  describe("POST /products/:id/assets", () => {
    it("uploads without changing the product and audits it", async () => {
      const product = await createProduct();

      const res = await testApp
        .post(`${ASTORE}/products/${product.id}/assets`)
        .set(adminHeaders)
        .attach("image", image(), png);

      expect(res.status).toBe(201);
      expect(res.body.data).toEqual({
        url: cloudinaryTestUrl("v1/astore-products/upload-1.webp"),
        publicId: "astore-products/upload-1",
      });
      expect(uploadToCloudinary).toHaveBeenCalledWith(
        expect.any(Buffer),
        "astore-products",
        "image/png"
      );

      const after = await prisma.aStoreProduct.findUnique({
        where: { id: product.id },
      });
      expect(after?.imageUrls).toEqual([]);

      const audit = await prisma.adminAuditLog.findFirst({
        where: {
          action: "astore.product.asset.upload",
          resourceId: product.id,
        },
      });
      expect(audit?.newValue).toMatchObject({
        publicId: "astore-products/upload-1",
      });
    });

    it("returns URLs that variants and preview overlays accept", async () => {
      const product = await createProduct();

      const variantImage = await testApp
        .post(`${ASTORE}/products/${product.id}/assets`)
        .set(adminHeaders)
        .attach("image", image(), png);
      const overlay = await testApp
        .post(`${ASTORE}/products/${product.id}/assets`)
        .set(adminHeaders)
        .attach("image", image(), png);

      const variant = await testApp
        .post(`${ASTORE}/products/${product.id}/variants`)
        .set(adminHeaders)
        .send({ colorName: "Black", imageUrls: [variantImage.body.data.url] });
      expect(variant.status).toBe(201);
      expect(variant.body.data.imageUrls).toEqual([variantImage.body.data.url]);

      const updated = await testApp
        .patch(`${ASTORE}/products/${product.id}`)
        .set(adminHeaders)
        .send({
          metadata: {
            preview: { enabled: true, frontOverlayUrl: overlay.body.data.url },
          },
        });
      expect(updated.status).toBe(200);
      expect(updated.body.data.metadata.preview.frontOverlayUrl).toBe(
        overlay.body.data.url
      );
    });

    it("returns 404 for an unknown product without uploading", async () => {
      const res = await testApp
        .post(`${ASTORE}/products/00000000-0000-4000-8000-000000000000/assets`)
        .set(adminHeaders)
        .attach("image", image(), png);

      expect(res.status).toBe(404);
      expect(uploadToCloudinary).not.toHaveBeenCalled();
    });

    it("returns 400 when no file is attached", async () => {
      const product = await createProduct();
      const res = await testApp
        .post(`${ASTORE}/products/${product.id}/assets`)
        .set(adminHeaders);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Image file is required");
    });

    it("forbids non-staff", async () => {
      const product = await createProduct();
      const user = await createTestUser();
      const res = await testApp
        .post(`${ASTORE}/products/${product.id}/assets`)
        .set(authHeader(user.id))
        .attach("image", image(), png);

      expect(res.status).toBe(403);
      expect(uploadToCloudinary).not.toHaveBeenCalled();
    });

    it("returns 413 for files over 5MB", async () => {
      const product = await createProduct();
      const res = await testApp
        .post(`${ASTORE}/products/${product.id}/assets`)
        .set(adminHeaders)
        .attach("image", Buffer.alloc(5 * 1024 * 1024 + 1), png);

      expect(res.status).toBe(413);
      expect(res.body.message).toBe("File is too large. Maximum size is 5MB.");
      expect(uploadToCloudinary).not.toHaveBeenCalled();
    });

    it("returns 400 for a non-image file", async () => {
      const product = await createProduct();
      const res = await testApp
        .post(`${ASTORE}/products/${product.id}/assets`)
        .set(adminHeaders)
        .attach("image", Buffer.from("%PDF-1.4"), {
          filename: "doc.pdf",
          contentType: "application/pdf",
        });

      expect(res.status).toBe(400);
      expect(uploadToCloudinary).not.toHaveBeenCalled();
    });

    it("returns 400 for the wrong file field name", async () => {
      const product = await createProduct();
      const res = await testApp
        .post(`${ASTORE}/products/${product.id}/assets`)
        .set(adminHeaders)
        .attach("file", image(), png);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Unexpected file field "file"');
    });
  });

  describe("POST /products/:id/images", () => {
    const fullGallery = (count: number) =>
      Array.from({ length: count }, (_, i) =>
        cloudinaryTestUrl(`v1/astore-products/seed-${i}.webp`)
      );

    it("appends the uploaded image to the gallery", async () => {
      const product = await createProduct();
      const res = await testApp
        .post(`${ASTORE}/products/${product.id}/images`)
        .set(adminHeaders)
        .attach("image", image(), png);

      expect(res.status).toBe(201);
      expect(res.body.data.product.imageUrls).toEqual([res.body.data.url]);
    });

    it("returns 409 at 10 images without uploading", async () => {
      const product = await createProduct(fullGallery(10));
      const res = await testApp
        .post(`${ASTORE}/products/${product.id}/images`)
        .set(adminHeaders)
        .attach("image", image(), png);

      expect(res.status).toBe(409);
      expect(uploadToCloudinary).not.toHaveBeenCalled();
    });

    it("lets only one of two concurrent uploads take the last slot", async () => {
      const product = await createProduct(fullGallery(9));

      // Hold both uploads until both requests have passed the pre-upload
      // check, so they race on the transaction rather than running in turn.
      let release!: () => void;
      const bothUploading = new Promise<void>((resolve) => (release = resolve));
      vi.mocked(uploadToCloudinary).mockImplementation(async () => {
        uploads += 1;
        const n = uploads;
        if (n === 2) release();
        await bothUploading;
        return {
          url: cloudinaryTestUrl(`v1/astore-products/upload-${n}.webp`),
          publicId: `astore-products/upload-${n}`,
        };
      });

      const results = await Promise.all(
        [0, 1].map(() =>
          testApp
            .post(`${ASTORE}/products/${product.id}/images`)
            .set(adminHeaders)
            .attach("image", image(), png)
        )
      );

      const statuses = results.map((r) => r.status).sort();
      expect(statuses).toEqual([201, 409]);

      const after = await prisma.aStoreProduct.findUnique({
        where: { id: product.id },
      });
      expect(after?.imageUrls).toHaveLength(10);

      // The rejected upload is removed from Cloudinary
      const loser = results.find((r) => r.status === 409)!;
      const winnerUrl = results.find((r) => r.status === 201)!.body.data.url;
      expect(loser.body.message).toMatch(/maximum of 10 images/);
      expect(deleteFromCloudinary).toHaveBeenCalledTimes(1);
      const deletedId = vi.mocked(deleteFromCloudinary).mock.calls[0][0];
      expect(winnerUrl).not.toContain(deletedId);
    });
  });
});
