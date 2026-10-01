import { describe, expect, it } from "vitest";
import env from "@/env";
import {
  isOwnCloudinaryUrl,
  zCloudinaryUrl,
} from "@/shared/utils/zod/cloudinaryUrl";

const own = `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/upload/v1/wallpapers/a.webp`;

describe("zCloudinaryUrl", () => {
  it("accepts delivery URLs on our Cloudinary account", () => {
    expect(isOwnCloudinaryUrl(own)).toBe(true);
    expect(
      isOwnCloudinaryUrl(
        `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/upload/c_fill,w_400/v1/avatars/x`
      )
    ).toBe(true);
    expect(zCloudinaryUrl.safeParse(own).success).toBe(true);
  });

  it.each([
    "https://images.unsplash.com/photo-123.jpg",
    "https://cdn.example.com/a.png",
    "https://res.cloudinary.com/some-other-account/image/upload/a.png",
    `http://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/upload/a.png`,
    `https://res.cloudinary.com.evil.com/${env.CLOUDINARY_CLOUD_NAME}/image/upload/a.png`,
    `https://evil.com/res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/a.png`,
    "not a url",
  ])("rejects %s", (url) => {
    expect(isOwnCloudinaryUrl(url)).toBe(false);
    expect(zCloudinaryUrl.safeParse(url).success).toBe(false);
  });
});
