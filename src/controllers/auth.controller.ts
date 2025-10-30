import crypto from "crypto";
import { prisma } from "@/server";
import type {
  TForgotPassword,
  TLogin,
  TResetPassword,
  TUpdatePassword,
  TVerifyEmail,
  TResendVerificationEmail,
} from "@/schemas/index";
import { userService } from "@/service/user.service";
import AppError from "@/utils/appError";
import catchAsync from "@/utils/catchAsync";
import Email from "@/utils/email";
import { handleServiceResponse } from "@/utils/httpHandlers";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { StatusCodes } from "http-status-codes";
import jwt from "jsonwebtoken";
import env from "@/env";
import { generateUniqueId } from "@/utils/uniqueId";

const signToken = (id: string): string => {
  const secret = env.JWT_SECRET;
  const expiresIn = env.JWT_EXPIRES_IN;

  return jwt.sign({ id }, secret, { expiresIn } as any);
};

class AuthController {
  public login: RequestHandler = catchAsync(
    async (req: Request<{}, {}, TLogin>, res: Response, next: NextFunction) => {
      const { email, password } = req.body;
      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          name: true,
          email: true,
          active: true,
          password: true, // Need this for comparison
          isEmailVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (
        !user ||
        !(await userService.comparePassword(password as string, user.password))
      ) {
        return next(new AppError("Incorrect email or password", 401));
      }

      // Check if email is verified
      if (!user.isEmailVerified) {
        return next(
          new AppError(
            "Please verify your email address before logging in. Check your inbox for the verification code.",
            403
          )
        );
      }

      // Remove password from user object before sending response
      const { password: _, ...userWithoutPassword } = user;

      const token = signToken(user.id);
      const cookieExpirationInMs = Math.floor(
        Number(process.env.JWT_COOKIE_EXPIRES_IN || 1) * 24 * 60 * 60 * 1000
      );
      const expiresIn = new Date(Date.now() + cookieExpirationInMs);

      const cookieOptions = {
        expires: expiresIn,
        maxAge: cookieExpirationInMs,
        httpOnly: true,
        path: "/",
        sameSite:
          process.env.NODE_ENV === "production"
            ? "none"
            : ("lax" as "none" | "lax"),
        secure: process.env.NODE_ENV === "production",
        domain:
          process.env.NODE_ENV === "production"
            ? process.env.COOKIE_DOMAIN
            : "localhost",
      };

      res.cookie("access", token, cookieOptions);
      res.cookie("logged_in", true, {
        ...cookieOptions,
        httpOnly: false,
      });

      res.status(200).json({
        message: "Logged in successfully",
        success: true,
        data: {
          user: userWithoutPassword,
          token,
        },
        statusCode: StatusCodes.OK,
      });
    }
  );

  public logout: RequestHandler = catchAsync(
    async (req: Request, res: Response, _next: NextFunction) => {
      res.clearCookie("access");
      res.clearCookie("logged_in");
      res.status(200).json({
        message: "Logged out successfully",
        statusCode: StatusCodes.OK,
        data: null,
        success: true,
      });
    }
  );

  public forgotPassword: RequestHandler = catchAsync(
    async (
      req: Request<{}, {}, TForgotPassword>,
      res: Response,
      next: NextFunction
    ) => {
      // 1) Get user based on POSTed email
      const user = await prisma.user.findUnique({
        where: { email: req.body.email },
      });

      if (!user) {
        return next(
          new AppError("There is no user with that email address", 404)
        );
      }

      // 2) Generate the random reset token
      const resetToken = generateUniqueId(6);
      const hashedToken = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: hashedToken,
          passwordResetExpires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        },
      });

      try {
        await new Email(
          { ...user, profile: null },
          resetToken
        ).sendPasswordReset();

        res.status(200).json({
          status: "success",
          message: "Token sent to email!",
          data: null,
          statusCode: StatusCodes.OK,
        });
      } catch (err) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            passwordResetToken: null,
            passwordResetExpires: null,
          },
        });
        return next(
          new AppError(
            "There was an error sending the email. Try again later!",
            500
          )
        );
      }
    }
  );

  public resetPassword: RequestHandler = catchAsync(
    async (
      req: Request<{}, {}, TResetPassword>,
      res: Response,
      next: NextFunction
    ) => {
      // 1) Get user based on the token
      const hashedToken = crypto
        .createHash("sha256")
        .update(req.body.token)
        .digest("hex");

      const user = await prisma.user.findFirst({
        where: {
          passwordResetToken: hashedToken,
          passwordResetExpires: {
            gt: new Date(),
          },
        },
      });

      // 2) If token has not expired, and there is user, set the new password
      if (!user) {
        return next(new AppError("Token is invalid or has expired", 400));
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: await userService.hashPassword(req.body.password),
          passwordResetToken: null,
          passwordResetExpires: null,
          passwordChangedAt: new Date(),
        },
      });

      res.status(200).json({
        status: "success",
        message: "Password reset successfully!",
        data: null,
        statusCode: StatusCodes.OK,
      });
    }
  );

  public updatePassword: RequestHandler = catchAsync(
    async (
      req: Request<{}, {}, TUpdatePassword>,
      res: Response,
      next: NextFunction
    ) => {
      // 1) Get user from collection
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: {
          id: true,
          password: true, // Explicitly select password for comparison
        },
      });

      if (!user) {
        return next(new AppError("User not found", 404));
      }

      // 2) Check if POSTed current password is correct
      if (
        !(await userService.comparePassword(
          req.body.passwordCurrent,
          user.password
        ))
      ) {
        return next(new AppError("Your current password is wrong", 401));
      }

      // 3) If so, update password
      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: await userService.hashPassword(req.body.password),
          passwordChangedAt: new Date(),
        },
      });

      res.status(200).json({
        status: "success",
        message: "Password updated successfully!",
        data: null,
        statusCode: StatusCodes.OK,
      });
    }
  );

  public verifyEmail: RequestHandler = catchAsync(
    async (
      req: Request<{}, {}, TVerifyEmail>,
      res: Response,
      next: NextFunction
    ) => {
      const serviceResponse = await userService.verifyEmail(req.body.token);
      return handleServiceResponse(serviceResponse, res);
    }
  );

  public resendVerificationEmail: RequestHandler = catchAsync(
    async (
      req: Request<{}, {}, TResendVerificationEmail>,
      res: Response,
      next: NextFunction
    ) => {
      const serviceResponse = await userService.resendVerificationEmail(
        req.body.email
      );
      return handleServiceResponse(serviceResponse, res);
    }
  );
}

export default new AuthController();
