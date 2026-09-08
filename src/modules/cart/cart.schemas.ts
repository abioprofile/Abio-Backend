import z from "zod";

export const addCartItemSchema = z.object({
  body: z.object({
    productId: z.string().uuid(),
    variantId: z.string().uuid().optional().nullable(),
    quantity: z.number().int().min(1).max(99).default(1),
    customUsername: z.string().trim().min(1).max(80).optional(),
    preferredColor: z.string().trim().min(1).max(80).optional(),
    instructions: z.string().trim().max(1000).optional(),
    artworkUrl: z.string().url().optional(),
  }),
});

export const updateCartItemSchema = z.object({
  params: z.object({
    itemId: z.string().uuid(),
  }),
  body: z
    .object({
      quantity: z.number().int().min(1).max(99).optional(),
      customUsername: z.string().trim().min(1).max(80).nullable().optional(),
      preferredColor: z.string().trim().min(1).max(80).nullable().optional(),
      instructions: z.string().trim().max(1000).nullable().optional(),
      artworkUrl: z.string().url().nullable().optional(),
    })
    .refine((b) => Object.keys(b).length > 0, {
      message: "At least one field is required",
    }),
});

export const cartItemIdParamSchema = z.object({
  params: z.object({
    itemId: z.string().uuid(),
  }),
});

export type TAddCartItemBody = z.infer<typeof addCartItemSchema>["body"];
export type TUpdateCartItemBody = z.infer<typeof updateCartItemSchema>["body"];
