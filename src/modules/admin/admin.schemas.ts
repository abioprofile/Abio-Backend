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

export type TListUsersQuery = z.infer<typeof listUsersSchema>["query"];
export type TGetUserByIdParams = z.infer<typeof getUserByIdSchema>["params"];