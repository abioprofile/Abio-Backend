import { Router } from "express";
import { authenticate, hasRole } from "@/shared/middleware/auth.middleware";
import * as businessController from "./business.controller";

/** "Grow with Abio" lead capture — mount under /api/v1/user */
export const userBusinessRouter = Router();

userBusinessRouter.post(
  "/business-inquiries",
  authenticate,
  businessController.create
);

/** Sales/staff review of submitted leads — mount under /api/v1/admin */
export const adminBusinessRouter = Router();
const requireStaff = [authenticate, hasRole(["admin", "moderator"])] as const;

adminBusinessRouter.get(
  "/business-inquiries",
  ...requireStaff,
  businessController.listAll
);
