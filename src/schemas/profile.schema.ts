import z from "zod";

export const checkUsernameSchema = z.object({
  query: z.object({
    username: z
      .string({ required_error: "Username is required" })
      .min(3, "Username must be at least 3 characters")
      .max(30, "Username must be 30 characters or less")
      .regex(
        /^[a-zA-Z0-9_-]+$/,
        "Username can only contain letters, numbers, hyphens and underscores",
      ),
  }),
});

export const updateProfileSchema = z.object({
  body: z
    .object({
      username: z
        .string()
        .min(3, "Username must be at least 3 characters")
        .max(30, "Username must be 30 characters or less")
        .regex(
          /^[a-zA-Z0-9_-]+$/,
          "Username can only contain letters, numbers, hyphens and underscores",
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
          z
            .string()
            .min(1)
            .max(200, "Each goal must be 200 characters or less"),
        )
        .max(10, "Maximum 10 goals allowed")
        .optional(),
      avatarUrl: z.string().url("Invalid avatar URL").optional(),
      isPublic: z.boolean().optional(),
    })
    .partial(),
});

// User display preferences
export const updateFontSchema = z.object({
  body: z.object({
    name: z
      .string()
      .regex(
        /^[a-zA-Z0-9-]+$/,
        "Font name can only contain letters, numbers, hyphens",
      ),
    fillColor: z.string().regex(/^#[a-zA-Z0-9]{3,8}$/),
    strokeColor: z
      .string()
      .regex(/^#[a-zA-Z0-9]{3,8}$/)
      .optional(),
  }),
});

export const updateCornersSchema = z.object({
  body: z.object({
    type: z.enum<string, ['sharp', 'curved', 'round']>(['sharp', 'curved', 'round']),
    fillColor: z.string().regex(/^#[a-zA-Z0-9]{3,8}$/).optional(),
    strokeColor: z.string().regex(/^#[a-zA-Z0-9]{3,8}$/).optional(),
    opacity: z.number().min(0).max(1).optional(),
    shadowSize: z.string(),
    shadowColor: z.string().regex(/^#[a-zA-Z0-9]{3,8}$/),
  }),
});

export const updateBackgroundSchema = z.object({
  body: z.object({
    type: z.string(),
    image: z.string().url().optional(),
    backgroundColor: z
      .string()
      .regex(/^#[a-zA-Z0-9]{3,8}$/)
      .or(
        z.array(
          z.object({
            color: z.string(),
            amount: z.number().min(0).max(1),
          }),
        ),
      )
      .optional(),
  }),
});

export type TUpdateProfile = z.infer<typeof updateProfileSchema.shape.body>;
export type TCheckUsername = z.infer<typeof checkUsernameSchema.shape.query>;

export type TUpdateCorners = z.infer<typeof updateCornersSchema.shape.body>;
export type TUpdateFont = z.infer<typeof updateFontSchema.shape.body>;
export type TUpdateBackground = z.infer<
  typeof updateBackgroundSchema.shape.body
>;
