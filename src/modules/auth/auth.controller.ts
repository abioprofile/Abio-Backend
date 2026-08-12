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
import { durationToMs, revokeRefreshToken } from "./auth.tokens";
import {
  forgotPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  resendVerificationEmailSchema,
  resetPasswordSchema,
  signupSchema,
  updatePasswordSchema,
  verify2FaSchema,
  verifyEmailSchema,
} from "./auth.schemas";

const accessCookieOptions = () => {
  const maxAge = durationToMs(env.JWT_ACCESS_EXPIRES_IN);
  return {
    expires: new Date(Date.now() + maxAge),
    maxAge,
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

/** Refresh is scoped to auth routes so it's not sent on every API call. */
const refreshCookieOptions = () => {
  const maxAge = durationToMs(env.JWT_REFRESH_EXPIRES_IN);
  return {
    ...accessCookieOptions(),
    expires: new Date(Date.now() + maxAge),
    maxAge,
    path: "/api/v1/auth",
  };
};

const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string
) => {
  res.cookie("access", accessToken, accessCookieOptions());
  res.cookie("refresh", refreshToken, refreshCookieOptions());
  res.cookie("logged_in", true, {
    ...accessCookieOptions(),
    httpOnly: false,
  });
};

const clearAuthCookies = (res: Response) => {
  res.clearCookie("access", { path: "/" });
  res.clearCookie("refresh", { path: "/api/v1/auth" });
  res.clearCookie("logged_in", { path: "/" });
};

const readRefreshToken = (req: Request): string | undefined => {
  if (typeof req.body?.refreshToken === "string" && req.body.refreshToken) {
    return req.body.refreshToken;
  }
  if (typeof req.cookies?.refresh === "string" && req.cookies.refresh) {
    return req.cookies.refresh;
  }
  return undefined;
};

export const signup = catchAsync(async (req: Request, res: Response) => {
  const { body } = parseRequest(signupSchema, req);
  const serviceResponse = await authService.signup(body);
  return handleServiceResponse(serviceResponse, res);
});

export const login = catchAsync(async (req: Request, res: Response) => {
  const { body } = parseRequest(loginSchema, req);
  const { user, accessToken, refreshToken } = await authService.login(body);

  setAuthCookies(res, accessToken, refreshToken);

  res.status(StatusCodes.OK).json({
    message: "Logged in successfully",
    success: true,
    data: { user, accessToken, refreshToken },
    statusCode: StatusCodes.OK,
  });
});

export const refresh = catchAsync(async (req: Request, res: Response) => {
  const { body } = parseRequest(refreshTokenSchema, {
    body: { refreshToken: readRefreshToken(req) },
    query: req.query,
    params: req.params,
  });

  const tokens = await authService.refreshSession(body.refreshToken);

  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

  res.status(StatusCodes.OK).json({
    message: "Token refreshed successfully",
    success: true,
    data: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    },
    statusCode: StatusCodes.OK,
  });
});

export const logout = catchAsync(async (req: Request, res: Response) => {
  let accessToken: string | undefined;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    accessToken = req.headers.authorization.split(" ")[1];
  } else if (req.cookies?.access) {
    accessToken = req.cookies.access;
  }

  if (accessToken) {
    await blacklistToken(accessToken);
  }

  const refreshToken = readRefreshToken(req);
  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }

  clearAuthCookies(res);
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
    message: "Reset link sent to email!",
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

  if (serviceResponse.data?.accessToken && serviceResponse.data?.refreshToken) {
    setAuthCookies(
      res,
      serviceResponse.data.accessToken,
      serviceResponse.data.refreshToken
    );
  }

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
  const { accessToken, refreshToken } = serviceResponse.data!;

  setAuthCookies(res, accessToken, refreshToken);

  // Prefer cookies for refresh; only put short-lived access in the URL fragment-free query.
  return res.redirect(
    `${env.CLIENT_URL}/auth/google/callback?accessToken=${accessToken}`
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

  if (
    serviceResponse.success &&
    serviceResponse.data &&
    "accessToken" in serviceResponse.data &&
    "refreshToken" in serviceResponse.data
  ) {
    setAuthCookies(
      res,
      serviceResponse.data.accessToken as string,
      serviceResponse.data.refreshToken as string
    );
  }

  return handleServiceResponse(serviceResponse, res);
});
