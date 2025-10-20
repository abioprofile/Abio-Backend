import { profileService } from "@/service/profile.service";
import catchAsync from "@/utils/catchAsync";
import { handleServiceResponse } from "@/utils/httpHandlers";
import type { Response, NextFunction, RequestHandler, Request } from "express";
import { AuthenticatedRequest } from "@/types/express";
import type { TUpdateProfile, TCheckUsername } from "@/schemas/profile.schema";

class ProfileController {
  public getMyProfile: RequestHandler = catchAsync(
    async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
      const userId = req.user.id;
      const serviceResponse = await profileService.getByUserId(userId);
      return handleServiceResponse(serviceResponse, res);
    }
  );

  public updateMyProfile: RequestHandler = catchAsync(
    async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
      const userId = req.user.id;
      const serviceResponse = await profileService.update(
        userId,
        req.body as TUpdateProfile
      );
      return handleServiceResponse(serviceResponse, res);
    }
  );

  public getPublicProfile: RequestHandler = catchAsync(
    async (
      req: Request<{ username: string }>,
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
    async (req: Request, res: Response, _next: NextFunction) => {
      const { username } = req.query as TCheckUsername;
      const serviceResponse = await profileService.checkUsernameAvailability(
        username
      );
      return handleServiceResponse(serviceResponse, res);
    }
  );
}

export default new ProfileController();
