import z from "zod";

export const listPublicProductsSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    q: z.string().trim().min(1).optional(),
    type: z.enum(["standard", "custom"]).optional(),
  }),
});

export const publicProductParamSchema = z.object({
  params: z.object({
    /** UUID or slug */
    idOrSlug: z.string().trim().min(1),
  }),
});

export type TListPublicProductsQuery = z.infer<
  typeof listPublicProductsSchema
>["query"];
