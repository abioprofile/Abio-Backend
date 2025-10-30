import type {
  TCreateUser,
  TUpdateUser,
  TDeleteAccount,
} from "@/schemas/user.schema";
import { userService } from "@/service/user.service";
import catchAsync from "@/utils/catchAsync";
import { AuthenticatedRequest } from "@/types/express";
import { handleServiceResponse } from "@/utils/httpHandlers";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import AppError from "@/utils/appError";
import { StatusCodes } from "http-status-codes";

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
  public getLoggedInUser: RequestHandler = catchAsync(
    async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
      const id = req.user.id;
      const serviceResponse = await userService.findById(id);
      return handleServiceResponse(serviceResponse, res);
    }
  );

  public deleteMyAccount: RequestHandler = catchAsync(
    async (
      req: AuthenticatedRequest<{}, {}, TDeleteAccount>,
      res: Response,
      next: NextFunction
    ) => {
      const user = req.user;

      // Verify password before deletion
      const { password } = req.body;
      const isPasswordCorrect = await userService.comparePassword(
        password,
        user.password
      );

      if (!isPasswordCorrect) {
        return next(
          new AppError("Incorrect password", StatusCodes.UNAUTHORIZED)
        );
      }

      // Delete the user account and all associated data
      const serviceResponse = await userService.delete(user.id);

      // Clear cookies
      res.clearCookie("access");
      res.clearCookie("logged_in");

      return handleServiceResponse(serviceResponse, res);
    }
  );
}

export default new UserController();
