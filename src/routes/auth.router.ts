import AuthController from "@/controllers/auth.controller";
import { authenticate } from "@/middleware/auth.middleware";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  updatePasswordSchema,
  verifyEmailSchema,
  resendVerificationEmailSchema,
} from "@/schemas/index";
import { validateRequest } from "@/utils/httpHandlers";
import express, { type Router } from "express";

export const authRouter: Router = express.Router();

authRouter.post("/login", validateRequest(loginSchema), AuthController.login);

authRouter.post("/logout", AuthController.logout);

// Email verification routes
authRouter.post(
  "/verify-email",
  validateRequest(verifyEmailSchema),
  AuthController.verifyEmail
);

authRouter.post(
  "/resend-verification-email",
  validateRequest(resendVerificationEmailSchema),
  AuthController.resendVerificationEmail
);

// Password management routes
authRouter.post(
  "/forgot-password",
  validateRequest(forgotPasswordSchema),
  AuthController.forgotPassword
);

authRouter.post(
  "/reset-password",
  validateRequest(resetPasswordSchema),
  AuthController.resetPassword
);

authRouter.patch(
  "/update-password",
  authenticate,
  validateRequest(updatePasswordSchema),
  AuthController.updatePassword
);

export default authRouter;
