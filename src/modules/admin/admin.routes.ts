import { Router } from "express";
import { authenticate, hasRole } from "@/shared/middleware/auth.middleware";
import * as adminController from "./admin.controller";

const adminRouter = Router();

const requireStaff = [authenticate, hasRole(["admin", "moderator"])] as const;
const requireAdmin = [authenticate, hasRole(["admin"])] as const;

adminRouter.get("/me", ...requireStaff, adminController.getMe);
adminRouter.get("/users", ...requireStaff, adminController.listUsers);
adminRouter.get("/users/:id", ...requireStaff, adminController.getUserById);
adminRouter.patch("/users/:id", ...requireStaff, adminController.updateUser);
adminRouter.post(
  "/users/:id/badges",
  ...requireStaff,
  adminController.assignBadge
);
adminRouter.post(
  "/users/:id/badges/:badgeType/revoke",
  ...requireStaff,
  adminController.revokeBadge
);

/** Only admins can grant/revoke moderator staff role */
adminRouter.post(
  "/users/:id/roles/moderator/revoke",
  ...requireAdmin,
  adminController.revokeModerator
);

/** Only admins can invite moderators */
adminRouter.get("/invites", ...requireAdmin, adminController.listInvites);
adminRouter.post("/invites", ...requireAdmin, adminController.createInvite);
/** Any logged-in user can accept an invite for their own email */
adminRouter.post(
  "/invites/accept",
  authenticate,
  adminController.acceptInvite
);

export default adminRouter;
