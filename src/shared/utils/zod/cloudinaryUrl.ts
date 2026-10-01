import { z } from "zod";
import env from "@/env";

/** True only for delivery URLs on our own Cloudinary account. */
export const isOwnCloudinaryUrl = (value: string): boolean => {
  try {
    const { protocol, hostname, pathname } = new URL(value);
    return (
      protocol === "https:" &&
      hostname === "res.cloudinary.com" &&
      pathname.startsWith(`/${env.CLOUDINARY_CLOUD_NAME}/`)
    );
  } catch {
    return false;
  }
};

// Images must go through our upload endpoints; external URLs are rejected.
export const zCloudinaryUrl = z
  .string()
  .url()
  .refine(isOwnCloudinaryUrl, {
    message: "Image must be uploaded through Abio first (Cloudinary URL required)",
  });
