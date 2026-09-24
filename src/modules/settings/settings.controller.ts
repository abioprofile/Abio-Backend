import type { Request, Response } from "express";
import catchAsync from "@/shared/utils/catchAsync";
import {
  handleServiceResponse,
  parseRequest,
} from "@/shared/utils/httpHandlers";
import { AuthenticatedRequest } from "@/shared/types/express";
import * as settingsService from "./settings.service";
import {
  updateNotificationsSchema,
  updatePrivacySchema,
} from "./settings.schemas";

export const getPrivacy = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const response = await settingsService.getPrivacy(req.user.id);
    return handleServiceResponse(response, res);
  }
);

export const updatePrivacy = catchAsync(async (req: Request, res: Response) => {
  const { body } = parseRequest(updatePrivacySchema, req);
  const response = await settingsService.updatePrivacy(
    (req as AuthenticatedRequest).user.id,
    body
  );
  return handleServiceResponse(response, res);
});

export const getNotifications = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const response = await settingsService.getNotifications(req.user.id);
    return handleServiceResponse(response, res);
  }
);

export const updateNotifications = catchAsync(
  async (req: Request, res: Response) => {
    const { body } = parseRequest(updateNotificationsSchema, req);
    const response = await settingsService.updateNotifications(
      (req as AuthenticatedRequest).user.id,
      body
    );
    return handleServiceResponse(response, res);
  }
);
