import { Router } from "express";
import { authenticate, hasRole } from "@/shared/middleware/auth.middleware";
import { uploadImage } from "@/shared/middleware/upload.middleware";
import * as themesController from "./themes.controller";

const themesRouter = Router();

themesRouter.get("/", authenticate, themesController.index);
themesRouter.post(
  "/",
  authenticate,
  hasRole(["admin", "moderator"]),
  uploadImage.single("wallpaper_config[image]"),
  themesController.store,
);

themesRouter.get(
  "/:id",
  authenticate,
  hasRole(["admin", "moderator"]),
  themesController.show,
);
themesRouter.patch(
  "/:id",
  authenticate,
  hasRole(["admin", "moderator"]),
  themesController.update,
);
themesRouter.delete(
  "/:id",
  authenticate,
  hasRole(["admin", "moderator"]),
  themesController.destroy,
);
export default themesRouter;
