import z from "zod";
import { SOCIAL_PLATFORMS } from "@/utils/constants";

const urlRegex = /^https?:\/\/.+/;

// Helper function to check if URL matches known social platforms
const detectPlatform = (url: string): string | null => {
  for (const [key, platform] of Object.entries(SOCIAL_PLATFORMS)) {
    if (platform.urlPattern.test(url)) {
      return key.toLowerCase();
    }
  }
  return null;
};

export const createLinkSchema = z.object({
  body: z
    .object({
      title: z
        .string({ required_error: "Title is required" })
        .min(1, "Title is required")
        .max(100, "Title must be 100 characters or less"),
      url: z
        .string({ required_error: "URL is required" })
        .regex(
          urlRegex,
          "Invalid URL format - must start with http:// or https://"
        ),
      platform: z
        .string()
        .min(
          1,
          "Platform name is required when URL is not a recognized social platform"
        )
        .max(50, "Platform name must be 50 characters or less")
        .optional(),
      isVisible: z.boolean().default(true).optional(),
    })
    .refine(
      (data) => {
        // If URL matches a known social platform, platform is optional
        const detectedPlatform = detectPlatform(data.url);
        if (detectedPlatform) {
          return true;
        }
        // If URL doesn't match any known platform, platform must be provided
        return !!data.platform;
      },
      {
        message:
          "Platform field is required when URL is not a recognized social media platform",
        path: ["platform"],
      }
    ),
});

export const updateLinkSchema = z.object({
  body: z
    .object({
      title: z.string().min(1).max(100).optional(),
      url: z.string().regex(urlRegex, "Invalid URL format").optional(),
      platform: z
        .string()
        .min(1, "Platform name is required")
        .max(50, "Platform name must be 50 characters or less")
        .optional(),
      isVisible: z.boolean().optional(),
      displayOrder: z.number().int().min(0).optional(),
    })
    .partial()
    .refine(
      (data) => {
        // If URL is being updated, check platform requirement
        if (data.url) {
          const detectedPlatform = detectPlatform(data.url);
          if (!detectedPlatform && !data.platform) {
            return false;
          }
        }
        return true;
      },
      {
        message:
          "Platform field is required when updating to a URL that is not a recognized social media platform",
        path: ["platform"],
      }
    ),
});

export const reorderLinksSchema = z.object({
  body: z.object({
    links: z.array(
      z.object({
        id: z.string().uuid(),
        displayOrder: z.number().int().min(0),
      })
    ),
  }),
});

export type TCreateLink = z.infer<typeof createLinkSchema.shape.body>;
export type TUpdateLink = z.infer<typeof updateLinkSchema.shape.body>;
export type TReorderLinks = z.infer<typeof reorderLinksSchema.shape.body>;
