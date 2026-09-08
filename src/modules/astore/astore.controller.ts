import type { Response } from "express";
import catchAsync from "@/shared/utils/catchAsync";
import {
  handleServiceResponse,
  parseRequest,
} from "@/shared/utils/httpHandlers";
import type { AuthenticatedRequest } from "@/shared/types/express";
import * as astoreService from "./astore.service";
import {
  listProductsSchema,
  productIdParamSchema,
  createProductSchema,
  updateProductSchema,
  createVariantSchema,
  updateVariantSchema,
} from "./astore.schemas";

export const listProducts = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const { query } = parseRequest(listProductsSchema, req);
    const serviceResponse = await astoreService.listProducts(query);
    return handleServiceResponse(serviceResponse, res);
  }
);

export const getProductById = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const { params } = parseRequest(productIdParamSchema, req);
    const serviceResponse = await astoreService.getProductById(params.id);
    return handleServiceResponse(serviceResponse, res);
  }
);

export const createProduct = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const { body } = parseRequest(createProductSchema, req);
    const serviceResponse = await astoreService.createProduct(
      body,
      req.user!.id
    );
    return handleServiceResponse(serviceResponse, res);
  }
);

export const updateProduct = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const { params, body } = parseRequest(updateProductSchema, req);
    const serviceResponse = await astoreService.updateProduct(
      params.id,
      body,
      req.user!.id
    );
    return handleServiceResponse(serviceResponse, res);
  }
);

export const createVariant = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const { params, body } = parseRequest(createVariantSchema, req);
    const serviceResponse = await astoreService.createVariant(
      params.id,
      body,
      req.user!.id
    );
    return handleServiceResponse(serviceResponse, res);
  }
);

export const updateVariant = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const { params, body } = parseRequest(updateVariantSchema, req);
    const serviceResponse = await astoreService.updateVariant(
      params.id,
      params.variantId,
      body,
      req.user!.id
    );
    return handleServiceResponse(serviceResponse, res);
  }
);
