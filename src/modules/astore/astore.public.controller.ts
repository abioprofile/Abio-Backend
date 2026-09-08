import type { Request, Response } from "express";
import catchAsync from "@/shared/utils/catchAsync";
import {
  handleServiceResponse,
  parseRequest,
} from "@/shared/utils/httpHandlers";
import * as astoreService from "./astore.service";
import {
  listPublicProductsSchema,
  publicProductParamSchema,
} from "./astore.public.schemas";

export const listPublicProducts = catchAsync(
  async (req: Request, res: Response) => {
    const { query } = parseRequest(listPublicProductsSchema, req);
    const serviceResponse = await astoreService.listPublicProducts(query);
    return handleServiceResponse(serviceResponse, res);
  }
);

export const getPublicProduct = catchAsync(
  async (req: Request, res: Response) => {
    const { params } = parseRequest(publicProductParamSchema, req);
    const serviceResponse = await astoreService.getPublicProduct(
      params.idOrSlug
    );
    return handleServiceResponse(serviceResponse, res);
  }
);
