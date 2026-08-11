import type { Response, NextFunction, Request } from "express";
import catchAsync from "@/shared/utils/catchAsync";
import {
  handleServiceResponse,
  parseRequest,
} from "@/shared/utils/httpHandlers";
import AppError from "@/shared/utils/appError";
import type { AuthenticatedRequest } from "@/shared/types/express";
import * as linkService from "./link.service";
import {
  createLinkSchema,
  updateLinkSchema,
  reorderLinksSchema,
  linkIdParamSchema,
} from "./link.schemas";

export const create = catchAsync(async (req: Request, res: Response) => {
  const { body } = parseRequest(createLinkSchema, req);
  const serviceResponse = await linkService.create(
    (req as AuthenticatedRequest).user.id,
    body
  );
  return handleServiceResponse(serviceResponse, res);
});

export const getAll = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const serviceResponse = await linkService.getAllByUserId(req.user.id);
    return handleServiceResponse(serviceResponse, res);
  }
);

export const getById = catchAsync(async (req: Request, res: Response) => {
  const { params } = parseRequest(linkIdParamSchema, req);
  const serviceResponse = await linkService.getById(
    params.id,
    (req as AuthenticatedRequest).user.id
  );
  return handleServiceResponse(serviceResponse, res);
});

export const update = catchAsync(async (req: Request, res: Response) => {
  const { params } = parseRequest(linkIdParamSchema, req);
  const { body } = parseRequest(updateLinkSchema, req);
  const serviceResponse = await linkService.update(
    params.id,
    (req as AuthenticatedRequest).user.id,
    body
  );
  return handleServiceResponse(serviceResponse, res);
});

export const deleteLink = catchAsync(async (req: Request, res: Response) => {
  const { params } = parseRequest(linkIdParamSchema, req);
  const serviceResponse = await linkService.deleteLink(
    params.id,
    (req as AuthenticatedRequest).user.id
  );
  return handleServiceResponse(serviceResponse, res);
});

export const reorder = catchAsync(async (req: Request, res: Response) => {
  const { body } = parseRequest(reorderLinksSchema, req);
  const serviceResponse = await linkService.reorder(
    (req as AuthenticatedRequest).user.id,
    body
  );
  return handleServiceResponse(serviceResponse, res);
});

export const trackClick = catchAsync(async (req: Request, res: Response) => {
  const { params } = parseRequest(linkIdParamSchema, req);
  const serviceResponse = await linkService.trackClick(params.id);
  return handleServiceResponse(serviceResponse, res);
});

export const updateLinkIcon = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { params } = parseRequest(linkIdParamSchema, req);
    if (!req.file) {
      return next(new AppError("Please provide an image for the icon", 400));
    }
    const serviceResponse = await linkService.updateLinkIcon(
      params.id,
      req.file.buffer
    );
    return handleServiceResponse(serviceResponse, res);
  }
);
