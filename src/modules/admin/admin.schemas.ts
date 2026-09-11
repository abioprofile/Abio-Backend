import z from "zod";

/** GET /api/v1/admin/users query */
export const listUsersSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    /** Search name or email (case-insensitive) */
    q: z.string().trim().min(1).optional(),
    active: z.enum(["true", "false"]).optional(),
    hasBadge: z.enum(["true", "false"]).optional(),
  }),
});

export const getUserByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const updateUserSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    active: z.boolean(),
  }),
});

export const assignBadgeSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z
    .object({
      badgeType: z.literal("verified").default("verified"),
    })
    .default({}),
});

export const revokeBadgeSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
    badgeType: z.literal("verified"),
  }),
  body: z
    .object({
      reason: z.string().trim().min(1).max(500).optional(),
    })
    .default({}),
});

export const revokeModeratorSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z
    .object({
      reason: z.string().trim().min(1).max(500).optional(),
    })
    .default({}),
});

export const createInviteSchema = z.object({
  body: z.object({
    email: z.string().trim().email().toLowerCase(),
  }),
});

export const acceptInviteSchema = z.object({
  body: z.object({
    token: z.string().trim().min(1),
  }),
});

export const listInvitesSchema = z.object({
  query: z.object({
    q: z.string().trim().max(200).optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
    status: z.enum(["pending", "accepted", "expired"]).optional(),
  }),
});

export type TListUsersQuery = z.infer<typeof listUsersSchema>["query"];
export type TGetUserByIdParams = z.infer<typeof getUserByIdSchema>["params"];
export type TUpdateUserBody = z.infer<typeof updateUserSchema>["body"];
export type TAssignBadgeBody = z.infer<typeof assignBadgeSchema>["body"];
export type TRevokeBadgeBody = z.infer<typeof revokeBadgeSchema>["body"];
export type TRevokeModeratorBody = z.infer<typeof revokeModeratorSchema>["body"];
export type TCreateInviteBody = z.infer<typeof createInviteSchema>["body"];
export type TAcceptInviteBody = z.infer<typeof acceptInviteSchema>["body"];
export type TListInvitesQuery = z.infer<typeof listInvitesSchema>["query"];
