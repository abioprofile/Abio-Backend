import z from "zod";

export const deliveryZoneSchema = z.enum(["lagos", "outside_lagos"]);

export const checkoutSchema = z.object({
  body: z.object({
    deliveryZone: deliveryZoneSchema,
    shippingAddress: z.string().trim().min(5).max(500),
  }),
});

export const listOrdersSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

export const orderIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export type TCheckoutBody = z.infer<typeof checkoutSchema>["body"];
export type TListOrdersQuery = z.infer<typeof listOrdersSchema>["query"];
