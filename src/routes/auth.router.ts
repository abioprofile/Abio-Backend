import AuthController from "@/controllers/auth.controller";
import { authenticate } from "@/middleware/auth.middleware";
import { verify2FaSchema } from "@/schemas/auth.schema";
// import { deleteAccountSchema } from "@/schemas/auth.schema";
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
import passport from "passport";

export const authRouter: Router = express.Router();

authRouter.post("/login", validateRequest(loginSchema), AuthController.login);

authRouter.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  }),
);
authRouter.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "https://abio.site/login",
  }),
  AuthController.loginWithGoogle,
);

authRouter.post("/logout", AuthController.logout);

// Email verification routes
authRouter.post(
  "/verify-email",
  validateRequest(verifyEmailSchema),
  AuthController.verifyEmail,
);

authRouter.post(
  "/resend-verification-email",
  validateRequest(resendVerificationEmailSchema),
  AuthController.resendVerificationEmail,
);

// Password management routes
authRouter.post(
  "/forgot-password",
  validateRequest(forgotPasswordSchema),
  AuthController.forgotPassword,
);

authRouter.post(
  "/reset-password",
  validateRequest(resetPasswordSchema),
  AuthController.resetPassword,
);

authRouter.patch(
  "/update-password",
  authenticate,
  validateRequest(updatePasswordSchema),
  AuthController.updatePassword,
);

// authRouter.delete(
//   '/delete-account',
//   authenticate,
//   validateRequest(deleteAccountSchema),
//   AuthController.closeAccount,
// );

authRouter.get('/2fa/totp/activate', authenticate, AuthController.setup2Fa);
authRouter.post('/2fa/totp/verify', validateRequest(verify2FaSchema), AuthController.verify2Fa);

export default authRouter;
