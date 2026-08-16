import z from "zod";

const hexColor = z
  .string()
  .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, "Must be a hex color like #fff or #ffffff");

const hexColorOrEmpty = z.union([
  hexColor,
  z.literal(""),
  z.null(),
]);

/** Style → Font (UI) */
export const fontConfigSchema = z.object({
  name: z
    .string()
    .min(1)
    .regex(
      /^[a-zA-Z0-9 -]+$/,
      "Font name can only contain letters, numbers, spaces, and hyphens"
    ),
  /** Text / italic / underline toggles from the Style row */
  italic: z.boolean().optional().default(false),
  underline: z.boolean().optional().default(false),
  fillColor: hexColor.optional(),
  weight: z
    .enum(["regular", "medium", "semibold", "bold"])
    .optional()
    .default("regular"),
});

/** Style → Corner (UI): shape, fill, stroke, opacity, shadow */
export const cornerConfigSchema = z.object({
  type: z.enum(["sharp", "curved", "round"]),
  fillColor: hexColor.optional(),
  strokeColor: hexColorOrEmpty.optional(),
  /** 0–1 (map UI slider 0–50 or 0–100 on the client) */
  opacity: z.number().min(0).max(1).optional(),
  shadow: z.enum(["none", "soft", "hard"]).optional().default("none"),
});

const gradientStopSchema = z.object({
  color: hexColor,
  amount: z.number().min(0).max(1),
});

/**
 * Wallpaper tab (UI): Fill | Gradient | Image
 * `solid` kept as an alias of `fill` for older clients.
 */
export const wallpaperConfigSchema = z
  .object({
    type: z.enum(["fill", "solid", "gradient", "image"]),
    image: z.string().url().optional(),
    backgroundColor: z.union([hexColor, z.array(gradientStopSchema)]).optional(),
  })
  .superRefine((data, ctx) => {
    const type = data.type === "solid" ? "fill" : data.type;

    if (type === "fill" && typeof data.backgroundColor !== "string") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "fill wallpaper requires backgroundColor as a hex string",
        path: ["backgroundColor"],
      });
    }

    if (type === "gradient" && !Array.isArray(data.backgroundColor)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "gradient wallpaper requires backgroundColor as an array of stops",
        path: ["backgroundColor"],
      });
    }

    if (type === "image" && !data.image) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "image wallpaper requires image URL (upload first)",
        path: ["image"],
      });
    }
  })
  .transform((data) => ({
    ...data,
    type: data.type === "solid" ? ("fill" as const) : data.type,
  }));

/** Save Changes → one PUT body (sections optional so FE can send only dirty tabs) */
export const updatePreferencesSchema = z.object({
  body: z
    .object({
      font_config: fontConfigSchema.optional(),
      corner_config: cornerConfigSchema.optional(),
      wallpaper_config: wallpaperConfigSchema.optional(),
      selected_theme: z.string().uuid().nullable().optional(),
    })
    .refine(
      (data) =>
        data.font_config !== undefined ||
        data.corner_config !== undefined ||
        data.wallpaper_config !== undefined ||
        data.selected_theme !== undefined,
      { message: "Provide at least one preferences field to update" }
    ),
});

export type TFontConfig = z.infer<typeof fontConfigSchema>;
export type TCornerConfig = z.infer<typeof cornerConfigSchema>;
export type TWallpaperConfig = z.infer<typeof wallpaperConfigSchema>;
export type TUpdatePreferences = z.infer<typeof updatePreferencesSchema.shape.body>;

/** @deprecated use fontConfigSchema — kept for any leftover imports */
export const updateFontSchema = z.object({ body: fontConfigSchema });
/** @deprecated use cornerConfigSchema */
export const updateCornersSchema = z.object({ body: cornerConfigSchema });
/** @deprecated use wallpaperConfigSchema */
export const updateBackgroundSchema = z.object({ body: wallpaperConfigSchema });

export type TUpdateFont = TFontConfig;
export type TUpdateCorners = TCornerConfig;
export type TUpdateBackground = TWallpaperConfig;
