import type { Request, Response, NextFunction } from "express";
import catchAsync from "@/shared/utils/catchAsync";
import {
  handleServiceResponse,
  parseRequest,
} from "@/shared/utils/httpHandlers";
import { AuthenticatedRequest } from "@/shared/types/express";
import AppError from "@/shared/utils/appError";
import * as profileService from "./profile.service";
import {
  checkUsernameSchema,
  updateProfileSchema,
  publicProfileParamSchema,
} from "./profile.schemas";

export const getMyProfile = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const serviceResponse = await profileService.getByUserId(req.user.id);
    return handleServiceResponse(serviceResponse, res);
  }
);

export const updateMyProfile = catchAsync(async (req: Request, res: Response) => {
  const { body } = parseRequest(updateProfileSchema, req);
  const serviceResponse = await profileService.update(
    (req as AuthenticatedRequest).user.id,
    body
  );
  return handleServiceResponse(serviceResponse, res);
});

export const getPublicProfile = catchAsync(async (req: Request, res: Response) => {
  const { params } = parseRequest(publicProfileParamSchema, req);
  const serviceResponse = await profileService.getPublicByUsername(
    params.username
  );
  return handleServiceResponse(serviceResponse, res);
});

export const checkUsername = catchAsync(async (req: Request, res: Response) => {
  const { query } = parseRequest(checkUsernameSchema, req);
  const serviceResponse = await profileService.checkUsernameAvailability(
    query.username
  );
  return handleServiceResponse(serviceResponse, res);
});

export const updateAvatar = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
      return next(new AppError("Please upload an image", 400));
    }

    const serviceResponse = await profileService.updateAvatar(
      (req as AuthenticatedRequest).user.id,
      req.file.buffer
    );
    return handleServiceResponse(serviceResponse, res);
  }
);
