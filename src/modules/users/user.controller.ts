import type { Request, Response, NextFunction } from "express";
import catchAsync from "@/shared/utils/catchAsync";
import {
  handleServiceResponse,
  parseRequest,
} from "@/shared/utils/httpHandlers";
import { AuthenticatedRequest } from "@/shared/types/express";
import AppError from "@/shared/utils/appError";
import { StatusCodes } from "http-status-codes";
import { ServiceResponse } from "@/shared/utils/serviceResponse";
import { prisma } from "@/shared/config/database";
import { userService } from "./user.service";
import { deleteAccountSchema, updateEmailSchema } from "./user.schemas";

export const getLoggedInUser = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const serviceResponse = await userService.findById(req.user.id);
    return handleServiceResponse(serviceResponse, res);
  }
);

export const deleteMyAccount = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { body } = parseRequest(deleteAccountSchema, req);
    const user = (req as AuthenticatedRequest).user;

    const userWithPassword = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, password: true },
    });

    if (!userWithPassword?.password) {
      return next(
        new AppError("Unable to verify password", StatusCodes.UNAUTHORIZED)
      );
    }

    const isPasswordCorrect = await userService.comparePassword(
      body.password,
      userWithPassword.password
    );

    if (!isPasswordCorrect) {
      return next(
        new AppError("Incorrect password", StatusCodes.UNAUTHORIZED)
      );
    }

    const serviceResponse = await userService.delete(user.id);

    res.clearCookie("access");
    res.clearCookie("logged_in");

    return handleServiceResponse(serviceResponse, res);
  }
);

export const updateEmail = catchAsync(
  async (req: Request, res: Response) => {
    const { body } = parseRequest(updateEmailSchema, req);
    const user = (req as AuthenticatedRequest).user;

    if (user.email === body.email) {
      return handleServiceResponse(
        ServiceResponse.success("", user, 200),
        res
      );
    }

    const serviceResponse = await userService.updateEmail(user, body.email);
    return handleServiceResponse(serviceResponse, res);
  }
);
