import {
  fontConfigSchema,
  cornerConfigSchema,
  wallpaperConfigSchema,
} from "@/modules/preferences/preferences.schemas";
import z from "zod";

export const createThemeSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(120),
    font_config: fontConfigSchema,
    corner_config: cornerConfigSchema,
    wallpaper_config: wallpaperConfigSchema,
  }),
});

export type TCreateTheme = z.infer<typeof createThemeSchema.shape.body>;

export const themeIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});
export const updateThemeSchema = z.object({
  params: themeIdSchema.shape.params,
  body: createThemeSchema.shape.body
    .partial()
    .refine((value) => Object.keys(value).length > 0, {
      message: "Provide at least one theme field",
    }),
});
export type TUpdateTheme = z.infer<typeof updateThemeSchema.shape.body>;
