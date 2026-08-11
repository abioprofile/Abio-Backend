import z from "zod";
import {
  updateFontSchema,
  updateCornersSchema,
  updateBackgroundSchema,
} from "@/schemas/profile.schema";

export const createThemeSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    font_config: updateFontSchema.shape.body,
    corner_config: updateCornersSchema.shape.body,
    wallpaper_config: updateBackgroundSchema.shape.body,
  }),
});

export type TCreateTheme = z.infer<typeof createThemeSchema.shape.body>;
