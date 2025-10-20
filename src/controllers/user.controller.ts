import type { TCreateUser, TUpdateUser } from "@/schemas/user.schema";
import { userService } from "@/service/user.service";
import catchAsync from "@/utils/catchAsync";
import { AuthenticatedRequest } from "@/types/express";
import { handleServiceResponse } from "@/utils/httpHandlers";
import type { NextFunction, Request, RequestHandler, Response } from "express";

class UserController {
    public createUser: RequestHandler = catchAsync(
      async (
        req: Request<{}, {}, TCreateUser>,
        res: Response,
        _next: NextFunction
      ) => {
        const serviceResponse = await userService.create(req.body);
        return handleServiceResponse(serviceResponse, res);
      }
    );
    public getLoggedInUser: RequestHandler<{}, any, any> = catchAsync(
      async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
        const id = req.user.id;
        const serviceResponse = await userService.findById(id);
        return handleServiceResponse(serviceResponse, res);
      }
    );
  }

export default new UserController();
