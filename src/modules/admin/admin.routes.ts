import { Router } from "express";
import { authenticate, hasRole } from "@/shared/middleware/auth.middleware";
import * as adminController from "./admin.controller";

const adminRouter = Router();

const requireStaff = [authenticate, hasRole(["admin", "moderator"])] as const;

adminRouter.get("/me", ...requireStaff, adminController.getMe);
adminRouter.get("/users", ...requireStaff, adminController.listUsers);

export default adminRouter;
