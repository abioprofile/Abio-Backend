import z from "zod";
import { SOCIAL_PLATFORMS } from "@/shared/utils/constants";
import type { AuthenticatedRequest } from "@/shared/types/express";

const urlRegex = /^https?:\/\/.+/;

/** Schema-only helper (truthy check); service uses uppercase keys for storage. */
const isKnownSocialUrl = (url: string): boolean => {
  return Object.values(SOCIAL_PLATFORMS).some((platform) =>
    platform.urlPattern.test(url)
  );
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
        if (isKnownSocialUrl(data.url)) {
          return true;
        }
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
        if (data.url) {
          if (!isKnownSocialUrl(data.url) && !data.platform) {
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

export const linkIdParamSchema = z.object({
  params: z.object({
    id: z
      .string({ required_error: "Object ID is required" })
      .uuid("Invalid UUID"),
  }),
});

export type TCreateLink = z.infer<typeof createLinkSchema.shape.body>;
export type TUpdateLink = z.infer<typeof updateLinkSchema.shape.body>;
export type TReorderLinks = z.infer<typeof reorderLinksSchema.shape.body>;

export interface CreateLinkRequest extends AuthenticatedRequest {
  body: TCreateLink;
}

export interface GetLinkRequest extends AuthenticatedRequest {
  params: { id: string };
}

export interface UpdateLinkRequest extends AuthenticatedRequest {
  params: { id: string };
  body: TUpdateLink;
}

export interface DeleteLinkRequest extends AuthenticatedRequest {
  params: { id: string };
}

export interface ReorderLinksRequest extends AuthenticatedRequest {
  body: TReorderLinks;
}

export interface TrackLinkClickRequest {
  params: { id: string };
}

export interface UpdateLinkIconRequest extends AuthenticatedRequest {
  params: { id: string };
  file?: Express.Multer.File;
}
