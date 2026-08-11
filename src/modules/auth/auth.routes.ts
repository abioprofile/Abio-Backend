import express, { type Router } from "express";
import passport from "passport";
import env from "@/env";
import { authenticate } from "@/shared/middleware/auth.middleware";
import * as authController from "./auth.controller";
import { loginRateLimiter } from "./auth.rate-limit";

const authRouter: Router = express.Router();

authRouter.post("/signup", authController.signup);
authRouter.post("/login", loginRateLimiter, authController.login);

authRouter.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  })
);
authRouter.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${env.CLIENT_URL}/auth/sign-in`,
  }),
  authController.loginWithGoogle
);

authRouter.post("/logout", authController.logout);

authRouter.post("/verify-email", authController.verifyEmail);
authRouter.post(
  "/resend-verification-email",
  authController.resendVerificationEmail
);

authRouter.post("/forgot-password", authController.forgotPassword);
authRouter.post("/reset-password", authController.resetPassword);
authRouter.patch(
  "/update-password",
  authenticate,
  authController.updatePassword
);

authRouter.get("/2fa/totp/activate", authenticate, authController.setup2Fa);
authRouter.post("/2fa/totp/verify", authController.verify2Fa);

export default authRouter;
