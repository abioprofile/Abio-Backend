import type { Response } from "express";
import catchAsync from "@/shared/utils/catchAsync";
import {
  handleServiceResponse,
  parseRequest,
} from "@/shared/utils/httpHandlers";
import type { AuthenticatedRequest } from "@/shared/types/express";
import * as analyticsService from "./analytics.service";
import { analyticsRangeSchema } from "./analytics.schemas";

export const getSummary = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const { query } = parseRequest(analyticsRangeSchema, req);
    const serviceResponse = await analyticsService.getSummary(
      req.user!.id,
      query
    );
    return handleServiceResponse(serviceResponse, res);
  }
);

export const getDaily = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const { query } = parseRequest(analyticsRangeSchema, req);
    const serviceResponse = await analyticsService.getDaily(
      req.user!.id,
      query
    );
    return handleServiceResponse(serviceResponse, res);
  }
);

export const getTopLinks = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const { query } = parseRequest(analyticsRangeSchema, req);
    const serviceResponse = await analyticsService.getTopLinks(
      req.user!.id,
      query
    );
    return handleServiceResponse(serviceResponse, res);
  }
);
