import {
  fontConfigSchema,
  cornerConfigSchema,
  wallpaperConfigSchema,
} from "@/modules/preferences/preferences.schemas";
import z from "zod";

export const createThemeSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    font_config: fontConfigSchema,
    corner_config: cornerConfigSchema,
    wallpaper_config: wallpaperConfigSchema,
  }),
});

export type TCreateTheme = z.infer<typeof createThemeSchema.shape.body>;
