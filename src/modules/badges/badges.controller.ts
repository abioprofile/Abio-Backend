import type { Response, NextFunction } from "express";
import catchAsync from "@/shared/utils/catchAsync";
import {
  handleServiceResponse,
  parseRequest,
} from "@/shared/utils/httpHandlers";
import type { AuthenticatedRequest } from "@/shared/types/express";
import AppError from "@/shared/utils/appError";
import * as badgesService from "./badges.service";
import {
  createBadgeRequestSchema,
  listBadgeRequestsSchema,
  badgeRequestIdParamSchema,
  rejectBadgeRequestSchema,
} from "./badges.schemas";

export const createBadgeRequest = catchAsync(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.file) {
      return next(new AppError("Please upload an ID document (image or PDF)", 400));
    }

    const { body } = parseRequest(createBadgeRequestSchema, req);
    const serviceResponse = await badgesService.createBadgeRequest(
      req.user!.id,
      body,
      req.file
    );
    return handleServiceResponse(serviceResponse, res);
  }
);

export const getMyBadgeStatus = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const serviceResponse = await badgesService.getMyBadgeStatus(req.user!.id);
    return handleServiceResponse(serviceResponse, res);
  }
);

export const listBadgeRequests = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const { query } = parseRequest(listBadgeRequestsSchema, req);
    const serviceResponse = await badgesService.listBadgeRequests(query);
    return handleServiceResponse(serviceResponse, res);
  }
);

export const approveBadgeRequest = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const { params } = parseRequest(badgeRequestIdParamSchema, req);
    const serviceResponse = await badgesService.approveBadgeRequest(
      params.id,
      req.user!.id
    );
    return handleServiceResponse(serviceResponse, res);
  }
);

export const rejectBadgeRequest = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const { params, body } = parseRequest(rejectBadgeRequestSchema, req);
    const serviceResponse = await badgesService.rejectBadgeRequest(
      params.id,
      body,
      req.user!.id
    );
    return handleServiceResponse(serviceResponse, res);
  }
);
