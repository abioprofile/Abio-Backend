import { profileService } from "@/service/profile.service";
import catchAsync from "@/utils/catchAsync";
import { handleServiceResponse } from "@/utils/httpHandlers";
import type { Response, NextFunction, RequestHandler } from "express";
import { AuthenticatedRequest } from "@/types/express";

class ProfileController {
  public getMyProfile: RequestHandler = catchAsync(
    async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
      const userId = req.user.id;
      const serviceResponse = await profileService.getByUserId(userId);
      return handleServiceResponse(serviceResponse, res);
    }
  );
}

export default new ProfileController();
