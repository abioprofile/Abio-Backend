import { Router } from "express";
import { authenticate, hasRole } from "@/shared/middleware/auth.middleware";
import { uploadIdDocument } from "@/shared/middleware/upload.middleware";
import * as badgesController from "./badges.controller";

/**
 * User-facing badge request routes — mount under /api/v1/user.
 * Auth must be per-route only: a router-level `authenticate` would run for
 * every /api/v1/user/* request and block public profile routes below.
 */
export const userBadgesRouter = Router();

userBadgesRouter.get(
  "/badges/requests/me",
  authenticate,
  badgesController.getMyBadgeStatus
);
userBadgesRouter.post(
  "/badges/requests",
  authenticate,
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
