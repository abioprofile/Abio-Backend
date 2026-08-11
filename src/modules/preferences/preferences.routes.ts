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
  "/preferences/background",
  authenticate,
  uploadImage.single("image"),
  preferencesController.updateStylePreference
);

preferencesRouter.put(
  "/preferences/fonts",
  authenticate,
  preferencesController.updateFontsPreference
);

preferencesRouter.put(
  "/preferences/corners",
  authenticate,
  preferencesController.updateCornerPreference
);

preferencesRouter.put(
  "/preferences",
  authenticate,
  preferencesController.updatePreferences
);

export default preferencesRouter;
