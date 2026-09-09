import z from "zod";

export const createBadgeRequestSchema = z.object({
  body: z.object({
    reason: z.string().trim().min(10).max(1000),
    badgeType: z.literal("verified").default("verified"),
  }),
});

export const listBadgeRequestsSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    status: z.enum(["pending", "approved", "rejected"]).optional(),
  }),
});

export const badgeRequestIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const rejectBadgeRequestSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z
    .object({
      reason: z.string().trim().min(1).max(500).optional(),
    })
    .default({}),
});

export type TCreateBadgeRequestBody = z.infer<
  typeof createBadgeRequestSchema
>["body"];
export type TListBadgeRequestsQuery = z.infer<
  typeof listBadgeRequestsSchema
>["query"];
export type TRejectBadgeRequestBody = z.infer<
  typeof rejectBadgeRequestSchema
>["body"];
