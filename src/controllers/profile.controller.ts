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

class ProfileController {
  public getMyProfile: RequestHandler = catchAsync(
    async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
      const serviceResponse = await profileService.getByUserId(req.user.id);
      return handleServiceResponse(serviceResponse, res);
    }
  );

  public updateMyProfile: RequestHandler = catchAsync(
    async (req: UpdateProfileRequest, res: Response, _next: NextFunction) => {
      const serviceResponse = await profileService.update(
        req.user.id,
        req.body
      );
      return handleServiceResponse(serviceResponse, res);
    }
  );

  public getPublicProfile: RequestHandler = catchAsync(
    async (
      req: GetPublicProfileRequest,
      res: Response,
      _next: NextFunction
    ) => {
      const serviceResponse = await profileService.getPublicByUsername(
        req.params.username
      );
      return handleServiceResponse(serviceResponse, res);
    }
  );

  public checkUsername: RequestHandler = catchAsync(
    async (req: CheckUsernameRequest, res: Response, _next: NextFunction) => {
      const serviceResponse = await profileService.checkUsernameAvailability(
        req.query.username
      );
      return handleServiceResponse(serviceResponse, res);
    }
  );
}

export default new ProfileController();
