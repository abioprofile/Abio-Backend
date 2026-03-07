import ThemeController from "@/controllers/themes.controller";
import { authenticate, hasRole } from "@/middleware/auth.middleware";
import { uploadImage } from "@/middleware/upload.middleware";
import { createThemeSchema } from "@/schemas/profile.schema";
import catchAsync from "@/utils/catchAsync";
import { validateRequest } from "@/utils/httpHandlers";
import { Router } from "express";

export default function themesRouter(): Router {
  const router = Router();

  router.get("/", authenticate, ThemeController.index);
  router.post(
    "/",
    authenticate,
    hasRole("admin"),
    uploadImage.single("image"),
    validateRequest(createThemeSchema),
    ThemeController.store,
  );

  return router;
}
