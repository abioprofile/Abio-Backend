import UserController from "@/controllers/user.controller";
import { authenticate, hasProfile } from "@/middleware/auth.middleware";
import { UUIDSchema, updateProfileSchema } from "@/schemas/index";
import { createUserSchema, updateUserSchema } from "@/schemas/user.schema";
import ProfileController from "../controllers/profile.controller";
import { validateRequest } from "@/utils/httpHandlers";
import express, { type Router } from "express";
const userRouter: Router = express.Router();

export default userRouter;
