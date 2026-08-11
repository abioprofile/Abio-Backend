import z from "zod";

export const updateFontSchema = z.object({
  body: z.object({
    name: z
      .string()
      .regex(
        /^[a-zA-Z0-9-]+$/,
        "Font name can only contain letters, numbers, hyphens"
      ),
    fillColor: z.string().optional(),
    strokeColor: z.string().optional(),
  }),
});

export const updateCornersSchema = z.object({
  body: z.object({
    type: z.enum(["sharp", "curved", "round"]),
    fillColor: z.string().optional(),
    strokeColor: z.string().optional(),
    opacity: z.number().min(0).max(1).optional(),
    shadowSize: z.string().optional(),
    shadowColor: z.string().optional(),
  }),
});

export const updateBackgroundSchema = z.object({
  body: z.object({
    type: z.string(),
    image: z.string().url().optional(),
    backgroundColor: z
      .string()
      .or(
        z.array(
          z.object({
            color: z.string(),
            amount: z.number().min(0).max(1),
          })
        )
      )
      .optional(),
  }),
});

export const updatePreferencesSchema = z.object({
  body: z.object({
    font_config: updateFontSchema.shape.body,
    wallpaper_config: updateBackgroundSchema.shape.body,
    corner_config: updateCornersSchema.shape.body,
  }),
});

export type TUpdateCorners = z.infer<typeof updateCornersSchema.shape.body>;
export type TUpdateFont = z.infer<typeof updateFontSchema.shape.body>;
export type TUpdateBackground = z.infer<
  typeof updateBackgroundSchema.shape.body
>;
export type TUpdatePreferences = z.infer<
  typeof updatePreferencesSchema.shape.body
>;
