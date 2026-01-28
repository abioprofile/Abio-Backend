import { profileService } from "@/service/profile.service";
import catchAsync from "@/utils/catchAsync";
import { handleServiceResponse } from "@/utils/httpHandlers";
import type { Response, NextFunction, RequestHandler } from "express";
import { AuthenticatedRequest } from "@/types/express";
import type {
  UpdateProfileRequest,
  CheckUsernameRequest,
  GetPublicProfileRequest,
} from "@/types";
import AppError from "@/utils/appError";
import preferencesService from "@/service/preferences.service";

class ProfileController {
  public getMyProfile: RequestHandler = catchAsync(
    async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
      const serviceResponse = await profileService.getByUserId(req.user.id);
      return handleServiceResponse(serviceResponse, res);
    },
  );

  public updateMyProfile: RequestHandler = catchAsync(
    async (req: UpdateProfileRequest, res: Response, _next: NextFunction) => {
      const serviceResponse = await profileService.update(
        req.user.id,
        req.body,
      );
      return handleServiceResponse(serviceResponse, res);
    },
  );

  public getPublicProfile: RequestHandler = catchAsync(
    async (
      req: GetPublicProfileRequest,
      res: Response,
      _next: NextFunction,
    ) => {
      const serviceResponse = await profileService.getPublicByUsername(
        req.params.username,
      );
      return handleServiceResponse(serviceResponse, res);
    },
  );

  public checkUsername: RequestHandler = catchAsync(
    async (req: CheckUsernameRequest, res: Response, _next: NextFunction) => {
      const serviceResponse = await profileService.checkUsernameAvailability(
        req.query.username,
      );
      return handleServiceResponse(serviceResponse, res);
    },
  );

  public updateAvatar: RequestHandler = catchAsync(
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.file) {
        return next(new AppError("Please upload an image", 400));
      }

      const serviceResponse = await profileService.updateAvatar(
        req.user.id,
        req.file.buffer,
      );
      return handleServiceResponse(serviceResponse, res);
    },
  );

  public updateStylePreference = catchAsync(
    async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
      const response = await preferencesService.updateBackgroundPreferences(req.user.id, req.body);
      return handleServiceResponse(response, res);
    },
  );

  public updateFontsPreference = catchAsync(
    async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
      const response = await preferencesService.updateFontPreferences(
        req.user.id,
        req.body,
      );
      return handleServiceResponse(response, res);
    },
  );

  public updateCornerPreference = catchAsync(
    async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
      const response = await preferencesService.updateCornerPreferences(req.user.id, req.body);
      return handleServiceResponse(response, res);
    },
  );

  public getDisplaySettings = catchAsync(
    async (req: AuthenticatedRequest, res: Response) => {
      const response = await preferencesService.getPreferences(req.user.id);
      return handleServiceResponse(response, res);
    }
  );
}

export default new ProfileController();
