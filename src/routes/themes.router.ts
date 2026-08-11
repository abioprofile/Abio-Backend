import ThemeController from "@/controllers/themes.controller";
import { authenticate, hasRole } from "@/shared/middleware/auth.middleware";
import { uploadImage } from "@/shared/middleware/upload.middleware";
import { createThemeSchema } from "@/schemas/profile.schema";
import catchAsync from "@/shared/utils/catchAsync";
import { validateRequest } from "@/shared/utils/httpHandlers";
import { Router } from "express";

export default function themesRouter(): Router {
  const router = Router();

  router.get("/", authenticate, ThemeController.index);
  router.post(
    "/",
    authenticate,
    hasRole("admin"),
    uploadImage.single("wallpaper_config[image]"),
    validateRequest(createThemeSchema),
    ThemeController.store,
  );

  return router;
}
