import type {
  TCreateUser,
  TUpdateUser,
  TDeleteAccount,
} from "@/schemas/user.schema";
import { userService } from "@/service/user.service";
import catchAsync from "@/shared/utils/catchAsync";
import { AuthenticatedRequest } from "@/shared/types/express";
import { handleServiceResponse } from "@/shared/utils/httpHandlers";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import AppError from "@/shared/utils/appError";
import { StatusCodes } from "http-status-codes";
import { ServiceResponse } from "@/shared/utils/serviceResponse";

class UserController {
  public createUser: RequestHandler = catchAsync(
    async (
      req: Request<{}, {}, TCreateUser>,
      res: Response,
      _next: NextFunction,
    ) => {
      const serviceResponse = await userService.create(req.body);
      return handleServiceResponse(serviceResponse, res);
    },
  );
  public getLoggedInUser: RequestHandler = catchAsync(
    async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
      const id = req.user.id;
      const serviceResponse = await userService.findById(id);
      return handleServiceResponse(serviceResponse, res);
    },
  );

  public deleteMyAccount: RequestHandler = catchAsync(
    async (
      req: AuthenticatedRequest<{}, {}, TDeleteAccount>,
      res: Response,
      next: NextFunction,
    ) => {
      const user = req.user;

      // Verify password before deletion
      const { password } = req.body;
      const isPasswordCorrect = await userService.comparePassword(
        password,
        user.password,
      );

      if (!isPasswordCorrect) {
        return next(
          new AppError("Incorrect password", StatusCodes.UNAUTHORIZED),
        );
      }

      // Delete the user account and all associated data
      const serviceResponse = await userService.delete(user.id);

      // Clear cookies
      res.clearCookie("access");
      res.clearCookie("logged_in");

      return handleServiceResponse(serviceResponse, res);
    },
  );

  public updateEmail: RequestHandler = catchAsync(
    async (req: AuthenticatedRequest, res: Response) => {
      const user = req.user;
      const { email } = req.body;

      if (user.email == email) {
        return handleServiceResponse(
          ServiceResponse.success("", user, 200),
          res,
        );
      }

      const serviceResponse = await userService.updateEmail(user, email);

      return handleServiceResponse(serviceResponse, res);
    },
  );
}

export default new UserController();
