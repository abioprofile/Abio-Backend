import type { TCreateUser, TUpdateUser } from "@/schemas/user.schema";
import { userService } from "@/service/user.service";
import catchAsync from "@/utils/catchAsync";
import { AuthenticatedRequest } from "@/types/express";
import { handleServiceResponse } from "@/utils/httpHandlers";
import type { NextFunction, Request, RequestHandler, Response } from "express";

class UserController {
  
}

export default new UserController();
