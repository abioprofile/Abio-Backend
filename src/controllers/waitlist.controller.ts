import { waitlistService } from "@/service/waitlist.service";
import catchAsync from "@/utils/catchAsync";
import { handleServiceResponse } from "@/utils/httpHandlers";
import type { Response, NextFunction, Request, RequestHandler } from "express";

class WaitlistController {
  public create: RequestHandler = catchAsync(
    async (req: Request, res: Response, _next: NextFunction) => {
      const serviceResponse = await waitlistService.create(req.body);
      return handleServiceResponse(serviceResponse, res);
    }
  );

  public getAll: RequestHandler = catchAsync(
    async (_req: Request, res: Response, _next: NextFunction) => {
      const serviceResponse = await waitlistService.getAll();
      return handleServiceResponse(serviceResponse, res);
    }
  );
}

export default new WaitlistController();
