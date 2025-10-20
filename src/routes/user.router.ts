import UserController from "@/controllers/user.controller";
import { authenticate, hasProfile } from "@/middleware/auth.middleware";
import { UUIDSchema, updateProfileSchema } from "@/schemas/index";
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

// Protected routes - require authentication
userRouter.get("/me", authenticate, UserController.getLoggedInUser);

userRouter.get("/profile", authenticate, ProfileController.getMyProfile);

export default userRouter;
