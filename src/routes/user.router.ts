import UserController from "@/controllers/user.controller";
import { authenticate, hasProfile } from "@/middleware/auth.middleware";
import {
  UUIDSchema,
  updateProfileSchema,
  checkUsernameSchema,
} from "@/schemas/index";
import { createUserSchema, updateUserSchema } from "@/schemas/user.schema";
import ProfileController from "../controllers/profile.controller";
import { validateRequest } from "@/utils/httpHandlers";
import express, { type Router } from "express";

export const userRouter: Router = express.Router();

// Public routes
userRouter.post(
  "/signup",
  validateRequest(createUserSchema),
  UserController.createUser
);

// Check username availability (public)
userRouter.get(
  "/check-username",
  validateRequest(checkUsernameSchema),
  ProfileController.checkUsername
);

// Protected routes - require authentication
userRouter.get("/", authenticate, UserController.getLoggedInUser);

// Profile routes
userRouter.get("/profile", authenticate, ProfileController.getMyProfile);
userRouter.patch(
  "/profile",
  authenticate,
  validateRequest(updateProfileSchema),
  ProfileController.updateMyProfile
);

export default userRouter;
