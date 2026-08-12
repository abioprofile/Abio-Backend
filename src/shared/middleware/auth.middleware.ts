import { promisify } from "util";
import { prisma } from "@/server";
import AppError from "@/shared/utils/appError";
import catchAsync from "@/shared/utils/catchAsync";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AuthenticatedRequest } from "@/shared/types/express";
import { isTokenBlacklisted } from "@/modules/auth/token-blacklist";

declare global {
  namespace Express {
    // Augment Passport's User so req.user has our fields
    interface User {
      id: string;
      [key: string]: unknown;
    }
  }
}

export const authenticate = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    // 1) Getting token and check of it's there
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies?.access) {
      token = req.cookies.access;
    }

    if (!token) {
      return next(
        new AppError(
          "You are not logged in! Please log in to get access.",
          401,
        ),
      );
    }

    // 2) Verification token
    const decoded = (await promisify<any>(jwt.verify as any)(
      token,
      process.env.JWT_SECRET as string,
    )) as jwt.JwtPayload & { id?: string; typ?: string };

    // Only short-lived access JWTs may authorize API calls (never refresh).
    if (decoded.typ !== "access" || typeof decoded.id !== "string") {
      return next(
        new AppError("Invalid access token. Please log in again.", 401),
      );
    }

    // 2b) Reject tokens revoked on logout
    if (await isTokenBlacklisted(token)) {
      return next(
        new AppError("Token is no longer valid. Please log in again.", 401),
      );
    }

    // 3) Check if user still exists
    const currentUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: {
        profile: true,
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!currentUser) {
      return next(
        new AppError(
          "The user belonging to this token does no longer exist.",
          401,
        ),
      );
    }

    // 4) Check if user changed password after the token was issued
    if (decoded.iat && currentUser.passwordChangedAt) {
      const changedTimestamp =
        new Date(currentUser.passwordChangedAt).getTime() / 1000;
      if (decoded.iat < changedTimestamp) {
        return next(
          new AppError(
            "User recently changed password! Please log in again.",
            401,
          ),
        );
      }
    }

    // GRANT ACCESS TO PROTECTED ROUTE
    req.user = currentUser;
    res.locals.user = currentUser;
    next();
  },
);

export const hasProfile = catchAsync(
  async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError("Not authenticated", 401));
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: req.user.id },
    });

    if (!profile) {
      return next(
        new AppError("User profile not found. Complete onboarding.", 404),
      );
    }
    
    return next();
  },
);

export const hasRole = (_role: string) =>
  catchAsync(async function (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction,
  ) {
    if (!req.user) {
      return next(new AppError("Not authenticated", 401));
    }

    if (!req.user.roles.find(({ role }) => role.name === _role)) {
      return next(new AppError("Not authorized", 403));
    }

    return next();
  });
