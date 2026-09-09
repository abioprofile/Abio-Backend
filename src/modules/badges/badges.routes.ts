import { Router } from "express";
import { authenticate, hasRole } from "@/shared/middleware/auth.middleware";
import { uploadIdDocument } from "@/shared/middleware/upload.middleware";
import * as badgesController from "./badges.controller";

/** User-facing badge request routes — mount under /api/v1/user */
export const userBadgesRouter = Router();
userBadgesRouter.use(authenticate);

userBadgesRouter.get(
  "/badges/requests/me",
  badgesController.getMyBadgeStatus
);
userBadgesRouter.post(
  "/badges/requests",
  uploadIdDocument.single("idDocument"),
  badgesController.createBadgeRequest
);

/** Staff badge-request review — mount under /api/v1/admin */
export const adminBadgesRouter = Router();
const requireStaff = [authenticate, hasRole(["admin", "moderator"])] as const;

adminBadgesRouter.get(
  "/badge-requests",
  ...requireStaff,
  badgesController.listBadgeRequests
);
adminBadgesRouter.post(
  "/badge-requests/:id/approve",
  ...requireStaff,
  badgesController.approveBadgeRequest
);
adminBadgesRouter.post(
  "/badge-requests/:id/reject",
  ...requireStaff,
  badgesController.rejectBadgeRequest
);
