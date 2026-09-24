import express, { type Router } from "express";
import { authenticate } from "@/shared/middleware/auth.middleware";
import * as settingsController from "./settings.controller";

const settingsRouter: Router = express.Router();

settingsRouter.get(
  "/settings/privacy",
  authenticate,
  settingsController.getPrivacy
);
settingsRouter.patch(
  "/settings/privacy",
  authenticate,
  settingsController.updatePrivacy
);

settingsRouter.get(
  "/settings/notifications",
  authenticate,
  settingsController.getNotifications
);
settingsRouter.patch(
  "/settings/notifications",
  authenticate,
  settingsController.updateNotifications
);

export default settingsRouter;
