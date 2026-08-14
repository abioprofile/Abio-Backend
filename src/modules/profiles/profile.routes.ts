import express, { type Router } from "express";
import { authenticate } from "@/shared/middleware/auth.middleware";
import { uploadImage } from "@/shared/middleware/upload.middleware";
import * as profileController from "./profile.controller";

const profileRouter: Router = express.Router();

profileRouter.get("/check-username", profileController.checkUsername);

profileRouter.get("/profile", authenticate, profileController.getMyProfile);
profileRouter.patch(
  "/profile",
  authenticate,
  profileController.updateMyProfile
);
profileRouter.patch(
  "/profile/avatar",
  authenticate,
  uploadImage.single("avatar"),
  profileController.updateAvatar
);
profileRouter.delete(
  "/profile/avatar",
  authenticate,
  profileController.deleteAvatar
);

// Must stay last among /api/v1/user mounts — matches any username
profileRouter.get("/:username", profileController.getPublicProfile);

export default profileRouter;
