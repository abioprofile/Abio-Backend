import z from "zod";

export const updateProfileSchema = z.object({
  body: z
    .object({
      username: z
        .string()
        .min(3, "Username must be at least 3 characters")
        .max(30, "Username must be 30 characters or less")
        .regex(
          /^[a-zA-Z0-9_-]+$/,
          "Username can only contain letters, numbers, hyphens and underscores"
        )
        .optional(),
      displayName: z
        .string()
        .min(1, "Display name is required")
        .max(100, "Display name must be 100 characters or less")
        .optional(),
      bio: z.string().max(500, "Bio must be 500 characters or less").optional(),
      location: z
        .string()
        .max(100, "Location must be 100 characters or less")
        .optional(),
      goals: z
        .array(
          z.string().min(1).max(200, "Each goal must be 200 characters or less")
        )
        .max(10, "Maximum 10 goals allowed")
        .optional(),
      avatarUrl: z.string().url("Invalid avatar URL").optional(),
      isPublic: z.boolean().optional(),
    })
    .partial(),
});

export type TUpdateProfile = z.infer<typeof updateProfileSchema.shape.body>;
