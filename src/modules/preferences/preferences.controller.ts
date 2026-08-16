import type { Request, Response, NextFunction } from "express";
import catchAsync from "@/shared/utils/catchAsync";
import {
  handleServiceResponse,
  parseRequest,
} from "@/shared/utils/httpHandlers";
import { AuthenticatedRequest } from "@/shared/types/express";
import AppError from "@/shared/utils/appError";
import * as preferencesService from "./preferences.service";
import { updatePreferencesSchema } from "./preferences.schemas";

export const getDisplaySettings = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const response = await preferencesService.getPreferences(req.user.id);
    return handleServiceResponse(response, res);
  }
);

/** Save Changes — full appearance payload (font / corner / wallpaper / theme). */
export const updatePreferences = catchAsync(
  async (req: Request, res: Response) => {
    const { body } = parseRequest(updatePreferencesSchema, req);
    const response = await preferencesService.updatePreferences(
      (req as AuthenticatedRequest).user.id,
      body
    );
    return handleServiceResponse(response, res);
  }
);

/**
 * Upload wallpaper image only. Client then includes returned `url` in
 * PUT /preferences → wallpaper_config: { type: "image", image: url }.
 */
export const uploadWallpaper = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
      return next(new AppError("Please upload an image", 400));
    }

    const response = await preferencesService.uploadWallpaperImage(
      (req as AuthenticatedRequest).user.id,
      req.file.buffer,
      req.file.mimetype
    );
    return handleServiceResponse(response, res);
  }
);
