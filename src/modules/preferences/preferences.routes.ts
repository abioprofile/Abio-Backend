import express, { type Router } from "express";
import { authenticate } from "@/shared/middleware/auth.middleware";
import { uploadImage } from "@/shared/middleware/upload.middleware";
import * as preferencesController from "./preferences.controller";

const preferencesRouter: Router = express.Router();

preferencesRouter.get(
  "/preferences",
  authenticate,
  preferencesController.getDisplaySettings
);

preferencesRouter.put(
  "/preferences",
  authenticate,
  preferencesController.updatePreferences
);

preferencesRouter.post(
  "/preferences/wallpaper/image",
  authenticate,
  uploadImage.single("image"),
  preferencesController.uploadWallpaper
);

export default preferencesRouter;
