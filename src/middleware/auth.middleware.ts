import { promisify } from "util";
import { prisma } from '@/server'
import AppError from "@/utils/appError";
import catchAsync from "@/utils/catchAsync";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      user?: any;
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
        new AppError("You are not logged in! Please log in to get access.", 401)
      );
    }

    // 2) Verification token
    const decoded = (await promisify<any>(jwt.verify as any)(
      token,
      process.env.JWT_SECRET as string
    )) as jwt.JwtPayload;

    // 3) Check if user still exists
    const currentUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { profile: true },
    });
    
    if (!currentUser) {
      return next(
        new AppError(
          "The user belonging to this token does no longer exist.",
          401
        )
      );
    }

    // 4) Check if user changed password after the token was issued
    if (decoded.iat && currentUser.passwordChangedAt) {
      const changedTimestamp = new Date(currentUser.passwordChangedAt).getTime() / 1000;
      if (decoded.iat < changedTimestamp) {
        return next(
          new AppError(
            "User recently changed password! Please log in again.",
            401
          )
        );
      }
    }

    // GRANT ACCESS TO PROTECTED ROUTE
    req.user = currentUser;
    res.locals.user = currentUser;
    next();
  }
);

export const hasProfile = catchAsync(
  async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError("Not authenticated", 401));
    }
    
    const profile = await prisma.profile.findUnique({
      where: { userId: req.user.id },
    });
    
    if (profile) {
      return next();
    }
    return next(new AppError("User profile not found. Complete onboarding.", 404));
  }
);
