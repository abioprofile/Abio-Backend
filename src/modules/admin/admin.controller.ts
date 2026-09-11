import type { Response } from "express";
import catchAsync from "@/shared/utils/catchAsync";
import {
  handleServiceResponse,
  parseRequest,
} from "@/shared/utils/httpHandlers";
import type { AuthenticatedRequest } from "@/shared/types/express";
import * as adminService from "./admin.service";
import {
  listUsersSchema,
  getUserByIdSchema,
  updateUserSchema,
  assignBadgeSchema,
  revokeBadgeSchema,
  revokeModeratorSchema,
  createInviteSchema,
  acceptInviteSchema,
  listInvitesSchema,
} from "./admin.schemas";

export const getMe = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const serviceResponse = await adminService.getMe(req.user!.id);
    return handleServiceResponse(serviceResponse, res);
  }
);

export const listUsers = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const { query } = parseRequest(listUsersSchema, req);
    const serviceResponse = await adminService.listUsers(query);
    return handleServiceResponse(serviceResponse, res);
  }
);

export const getUserById = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const { params } = parseRequest(getUserByIdSchema, req);
    const serviceResponse = await adminService.getUserById(params.id);
    return handleServiceResponse(serviceResponse, res);
  }
);

export const updateUser = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const { params, body } = parseRequest(updateUserSchema, req);
    const serviceResponse = await adminService.updateUser(
      params.id,
      body,
      req.user!.id
    );
    return handleServiceResponse(serviceResponse, res);
  }
);

export const assignBadge = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const { params, body } = parseRequest(assignBadgeSchema, req);
    const serviceResponse = await adminService.assignBadge(
      params.id,
      body,
      req.user!.id
    );
    return handleServiceResponse(serviceResponse, res);
  }
);

export const revokeBadge = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const { params, body } = parseRequest(revokeBadgeSchema, req);
    const serviceResponse = await adminService.revokeBadge(
      params.id,
      params.badgeType,
      body,
      req.user!.id
    );
    return handleServiceResponse(serviceResponse, res);
  }
);

export const revokeModerator = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const { params, body } = parseRequest(revokeModeratorSchema, req);
    const serviceResponse = await adminService.revokeModerator(
      params.id,
      body,
      req.user!.id
    );
    return handleServiceResponse(serviceResponse, res);
  }
);

export const listInvites = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const { query } = parseRequest(listInvitesSchema, req);
    const serviceResponse = await adminService.listInvites(query);
    return handleServiceResponse(serviceResponse, res);
  }
);

export const createInvite = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const { body } = parseRequest(createInviteSchema, req);
    const serviceResponse = await adminService.createInvite(
      body,
      req.user!.id
    );
    return handleServiceResponse(serviceResponse, res);
  }
);

export const acceptInvite = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const { body } = parseRequest(acceptInviteSchema, req);
    const serviceResponse = await adminService.acceptInvite(
      body,
      req.user!.id,
      req.user!.email
    );
    return handleServiceResponse(serviceResponse, res);
  }
);
