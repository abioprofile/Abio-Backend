import type { Request, Response } from "express";
import catchAsync from "@/shared/utils/catchAsync";
import {
  handleServiceResponse,
  parseRequest,
} from "@/shared/utils/httpHandlers";
import { linkIdParamSchema } from "@/modules/links/link.schemas";
import * as linkService from "@/modules/links/link.service";
import * as publicAnalyticsService from "./public.analytics.service";
import { trackProfileViewSchema } from "./public.schemas";

export const trackLinkClick = catchAsync(async (req: Request, res: Response) => {
  const { params } = parseRequest(linkIdParamSchema, req);
  const serviceResponse = await linkService.trackClick(params.id);
  return handleServiceResponse(serviceResponse, res);
});

export const trackProfileView = catchAsync(
  async (req: Request, res: Response) => {
    const { params } = parseRequest(trackProfileViewSchema, req);
    const serviceResponse = await publicAnalyticsService.trackProfileView(
      params.username
    );
    return handleServiceResponse(serviceResponse, res);
  }
);
