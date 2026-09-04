import type { Response } from "express";
import catchAsync from "@/shared/utils/catchAsync";
import {
  handleServiceResponse,
  parseRequest,
} from "@/shared/utils/httpHandlers";
import type { AuthenticatedRequest } from "@/shared/types/express";
import * as adminService from "./admin.service";
import { listUsersSchema } from "./admin.schemas";

export const getMe = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const serviceResponse = await adminService.getMe(req.user!.id);
    return handleServiceResponse(serviceResponse, res);
  }
);

export const listUsers = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { query } = parseRequest(listUsersSchema, req);
  const serviceResponse = await adminService.listUsers(query);
  return handleServiceResponse(serviceResponse, res);
});
