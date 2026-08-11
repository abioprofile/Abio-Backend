import type { Request, Response } from "express";
import catchAsync from "@/shared/utils/catchAsync";
import {
  handleServiceResponse,
  parseRequest,
} from "@/shared/utils/httpHandlers";
import { AuthenticatedRequest } from "@/shared/types/express";
import { ServiceResponse } from "@/shared/utils/serviceResponse";
import { uploadToCloudinary } from "@/shared/utils/cloudinary";
import * as preferencesService from "./preferences.service";
import {
  updateBackgroundSchema,
  updateCornersSchema,
  updateFontSchema,
  updatePreferencesSchema,
} from "./preferences.schemas";

export const getDisplaySettings = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const response = await preferencesService.getPreferences(req.user.id);
    return handleServiceResponse(response, res);
  }
);

export const updateStylePreference = catchAsync(
  async (req: Request, res: Response) => {
    const { body } = parseRequest(updateBackgroundSchema, req);
    const userId = (req as AuthenticatedRequest).user.id;

    if (body.type === "image" && !req.file) {
      return handleServiceResponse(
        ServiceResponse.failure("type 'image' requires a file", null, 400),
        res
      );
    }

    const data: Record<string, unknown> = { ...body };
    if (req.file) {
      data.image = await uploadToCloudinary(req.file.buffer, "wallpapers");
    }

    const response = await preferencesService.updateBackgroundPreferences(
      userId,
      data as any
    );
    return handleServiceResponse(response, res);
  }
);

export const updateFontsPreference = catchAsync(
  async (req: Request, res: Response) => {
    const { body } = parseRequest(updateFontSchema, req);
    const response = await preferencesService.updateFontPreferences(
      (req as AuthenticatedRequest).user.id,
      body
    );
    return handleServiceResponse(response, res);
  }
);

export const updateCornerPreference = catchAsync(
  async (req: Request, res: Response) => {
    const { body } = parseRequest(updateCornersSchema, req);
    const response = await preferencesService.updateCornerPreferences(
      (req as AuthenticatedRequest).user.id,
      body
    );
    return handleServiceResponse(response, res);
  }
);

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
