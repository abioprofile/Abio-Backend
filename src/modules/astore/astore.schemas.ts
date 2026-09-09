import z from "zod";

const productTypeSchema = z.enum(["standard", "custom"]);

export const listProductsSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    active: z.enum(["true", "false"]).optional(),
    q: z.string().trim().min(1).optional(),
  }),
});

export const productIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const createProductSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(120),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(140)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be lowercase kebab-case")
      .optional(),
    description: z.string().trim().max(2000).optional(),
    type: productTypeSchema,
    /** Shop is NGN-only; omitted or must be NGN */
    currency: z.literal("NGN").default("NGN"),
    basePriceKobo: z.number().int().min(0),
    imageUrls: z.array(z.string().url()).max(10).default([]),
    active: z.boolean().optional(),
  }),
});

export const updateProductSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z
    .object({
      name: z.string().trim().min(1).max(120).optional(),
      slug: z
        .string()
        .trim()
        .min(1)
        .max(140)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be lowercase kebab-case")
        .optional(),
      description: z.string().trim().max(2000).nullable().optional(),
      type: productTypeSchema.optional(),
      currency: z.literal("NGN").optional(),
      basePriceKobo: z.number().int().min(0).optional(),
      imageUrls: z.array(z.string().url()).max(10).optional(),
      active: z.boolean().optional(),
    })
    .refine((b) => Object.keys(b).length > 0, {
      message: "At least one field is required",
    }),
});

export const createVariantSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    colorName: z.string().trim().min(1).max(80),
    colorHex: z
      .string()
      .trim()
      .regex(/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/)
      .optional(),
    imageUrls: z.array(z.string().url()).max(10).default([]),
    stockQty: z.number().int().min(0).default(0),
    priceKobo: z.number().int().min(0).nullable().optional(),
    active: z.boolean().optional(),
  }),
});

export const updateVariantSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
    variantId: z.string().uuid(),
  }),
  body: z
    .object({
      colorName: z.string().trim().min(1).max(80).optional(),
      colorHex: z
        .string()
        .trim()
        .regex(/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/)
        .nullable()
        .optional(),
      imageUrls: z.array(z.string().url()).max(10).optional(),
      stockQty: z.number().int().min(0).optional(),
      priceKobo: z.number().int().min(0).nullable().optional(),
      active: z.boolean().optional(),
    })
    .refine((b) => Object.keys(b).length > 0, {
      message: "At least one field is required",
    }),
});

const orderStatusSchema = z.enum([
  "processing",
  "ready",
  "shipped",
  "received",
  "cancelled",
]);

const paymentStatusSchema = z.enum([
  "pending",
  "success",
  "failed",
  "reversed",
]);

export const listOrdersSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    status: orderStatusSchema.optional(),
    paymentStatus: paymentStatusSchema.optional(),
    q: z.string().trim().min(1).optional(),
  }),
});

export const orderIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const updateOrderSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z
    .object({
      status: orderStatusSchema.optional(),
      trackingNumber: z.string().trim().min(1).max(120).nullable().optional(),
    })
    .refine((b) => Object.keys(b).length > 0, {
      message: "At least one field is required",
    }),
});

export const metricsQuerySchema = z.object({
  query: z.object({
    /** ISO datetime — filters order/payment createdAt */
    from: z.string().min(1).optional(),
    to: z.string().min(1).optional(),
  }),
});

export type TListProductsQuery = z.infer<typeof listProductsSchema>["query"];
export type TCreateProductBody = z.infer<typeof createProductSchema>["body"];
export type TUpdateProductBody = z.infer<typeof updateProductSchema>["body"];
export type TCreateVariantBody = z.infer<typeof createVariantSchema>["body"];
export type TUpdateVariantBody = z.infer<typeof updateVariantSchema>["body"];
export type TListOrdersQuery = z.infer<typeof listOrdersSchema>["query"];
export type TUpdateOrderBody = z.infer<typeof updateOrderSchema>["body"];
export type TMetricsQuery = z.infer<typeof metricsQuerySchema>["query"];
