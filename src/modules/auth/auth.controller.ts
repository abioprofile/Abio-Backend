import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import type { User } from "@prisma/client";
import catchAsync from "@/shared/utils/catchAsync";
import {
  handleServiceResponse,
  parseRequest,
} from "@/shared/utils/httpHandlers";
import type { AuthenticatedRequest } from "@/shared/types/express";
import type { UserWithProfile } from "@/shared/types";
import AppError from "@/shared/utils/appError";
import env from "@/env";
import * as authService from "./auth.service";
import { blacklistToken } from "./token-blacklist";
import {
  forgotPasswordSchema,
  loginSchema,
  resendVerificationEmailSchema,
  resetPasswordSchema,
  updatePasswordSchema,
  verify2FaSchema,
  verifyEmailSchema,
} from "./auth.schemas";

const cookieOptions = () => {
  const cookieExpirationInMs = Math.floor(
    Number(process.env.JWT_COOKIE_EXPIRES_IN || 1) * 24 * 60 * 60 * 1000
  );
  const expiresIn = new Date(Date.now() + cookieExpirationInMs);

  return {
    expires: expiresIn,
    maxAge: cookieExpirationInMs,
    httpOnly: true,
    path: "/",
    sameSite:
      process.env.NODE_ENV === "production"
        ? ("none" as const)
        : ("lax" as const),
    secure: process.env.NODE_ENV === "production",
    domain:
      process.env.NODE_ENV === "production"
        ? process.env.COOKIE_DOMAIN
        : "localhost",
  };
};

export const login = catchAsync(async (req: Request, res: Response) => {
  const { body } = parseRequest(loginSchema, req);
  const { user, token } = await authService.login(body);
  const options = cookieOptions();

  res.cookie("access", token, options);
  res.cookie("logged_in", true, {
    ...options,
    httpOnly: false,
  });

  res.status(StatusCodes.OK).json({
    message: "Logged in successfully",
    success: true,
    data: { user, token },
    statusCode: StatusCodes.OK,
  });
});

export const logout = catchAsync(async (req: Request, res: Response) => {
  let token: string | undefined;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies?.access) {
    token = req.cookies.access;
  }

  if (token) {
    await blacklistToken(token);
  }

  res.clearCookie("access");
  res.clearCookie("logged_in");
  res.status(StatusCodes.OK).json({
    message: "Logged out successfully",
    statusCode: StatusCodes.OK,
    data: null,
    success: true,
  });
});

export const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  const { body } = parseRequest(forgotPasswordSchema, req);
  await authService.forgotPassword(body);

  res.status(StatusCodes.OK).json({
    status: "success",
    message: "Token sent to email!",
    data: null,
    statusCode: StatusCodes.OK,
  });
});

export const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const { body } = parseRequest(resetPasswordSchema, req);
  await authService.resetPassword(body);

  res.status(StatusCodes.OK).json({
    status: "success",
    message: "Password reset successfully!",
    data: null,
    statusCode: StatusCodes.OK,
  });
});

export const updatePassword = catchAsync(async (req: Request, res: Response) => {
  const { body } = parseRequest(updatePasswordSchema, req);
  await authService.updatePassword(
    (req as AuthenticatedRequest).user.id,
    body
  );

  res.status(StatusCodes.OK).json({
    status: "success",
    message: "Password updated successfully!",
    data: null,
    statusCode: StatusCodes.OK,
  });
});

export const verifyEmail = catchAsync(async (req: Request, res: Response) => {
  const { body } = parseRequest(verifyEmailSchema, req);
  const serviceResponse = await authService.verifyEmail(body.token);
  return handleServiceResponse(serviceResponse, res);
});

export const resendVerificationEmail = catchAsync(
  async (req: Request, res: Response) => {
    const { body } = parseRequest(resendVerificationEmailSchema, req);
    const serviceResponse = await authService.resendVerificationEmail(
      body.email
    );
    return handleServiceResponse(serviceResponse, res);
  }
);

export const loginWithGoogle = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Google authentication failed", StatusCodes.UNAUTHORIZED);
  }
  const serviceResponse = await authService.oauthLogin(req.user as User);
  return res.redirect(
    `${env.CLIENT_URL}/auth/google/callback?token=${serviceResponse.data.token}`
  );
});

export const setup2Fa = catchAsync(async (req: Request, res: Response) => {
  const serviceResponse = await authService.setup2Fa(
    (req as AuthenticatedRequest).user as unknown as UserWithProfile
  );
  return handleServiceResponse(serviceResponse, res);
});

export const verify2Fa = catchAsync(async (req: Request, res: Response) => {
  const { body } = parseRequest(verify2FaSchema, req);
  const serviceResponse = await authService.verify2FAOtp(
    body.email,
    body.token
  );
  return handleServiceResponse(serviceResponse, res);
});
