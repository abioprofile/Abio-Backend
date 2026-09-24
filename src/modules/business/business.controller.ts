import type { Request, Response } from "express";
import catchAsync from "@/shared/utils/catchAsync";
import {
  handleServiceResponse,
  parseRequest,
} from "@/shared/utils/httpHandlers";
import { AuthenticatedRequest } from "@/shared/types/express";
import * as businessService from "./business.service";
import {
  businessInquiryIdParamSchema,
  createBusinessInquirySchema,
  listBusinessInquiriesSchema,
} from "./business.schemas";

export const create = catchAsync(async (req: Request, res: Response) => {
  const { body } = parseRequest(createBusinessInquirySchema, req);
  const response = await businessService.create(
    (req as AuthenticatedRequest).user.id,
    body
  );
  return handleServiceResponse(response, res);
});

export const listAll = catchAsync(async (req: Request, res: Response) => {
  const { query } = parseRequest(listBusinessInquiriesSchema, req);
  const response = await businessService.listAll(query);
  return handleServiceResponse(response, res);
});

export const getById = catchAsync(async (req: Request, res: Response) => {
  const { params } = parseRequest(businessInquiryIdParamSchema, req);
  const response = await businessService.getById(params.id);
  return handleServiceResponse(response, res);
});
