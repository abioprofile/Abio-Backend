import z from "zod";

const urlRegex = /^https?:\/\/.+/;

export const createLinkSchema = z.object({
  body: z.object({
    title: z
      .string({ required_error: "Title is required" })
      .min(1, "Title is required")
      .max(100, "Title must be 100 characters or less"),
    url: z
      .string({ required_error: "URL is required" })
      .url("Invalid URL format - must start with http:// or https://"),
    isVisible: z.boolean().default(true).optional(),
  }),
});

export const updateLinkSchema = z.object({
  body: z
    .object({
      title: z.string().min(1).max(100).optional(),
      url: z.string().regex(urlRegex, "Invalid URL format").optional(),
      isVisible: z.boolean().optional(),
      displayOrder: z.number().int().min(0).optional(),
    })
    .partial(),
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
