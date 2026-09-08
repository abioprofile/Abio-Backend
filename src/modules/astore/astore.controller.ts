import type { Response } from "express";
import catchAsync from "@/shared/utils/catchAsync";
import {
  handleServiceResponse,
  parseRequest,
} from "@/shared/utils/httpHandlers";
import type { AuthenticatedRequest } from "@/shared/types/express";
import * as astoreService from "./astore.service";
import * as astoreOrdersService from "./astore.orders.service";
import * as astoreMetricsService from "./astore.metrics.service";
import {
  listProductsSchema,
  productIdParamSchema,
  createProductSchema,
  updateProductSchema,
  createVariantSchema,
  updateVariantSchema,
  listOrdersSchema,
  orderIdParamSchema,
  updateOrderSchema,
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

export const getMetrics = catchAsync(
  async (_req: AuthenticatedRequest, res: Response) => {
    const serviceResponse = await astoreMetricsService.getMetrics();
    return handleServiceResponse(serviceResponse, res);
  }
);

export const listOrders = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const { query } = parseRequest(listOrdersSchema, req);
    const serviceResponse = await astoreOrdersService.listOrders(query);
    return handleServiceResponse(serviceResponse, res);
  }
);

export const getOrderById = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const { params } = parseRequest(orderIdParamSchema, req);
    const serviceResponse = await astoreOrdersService.getOrderById(params.id);
    return handleServiceResponse(serviceResponse, res);
  }
);

export const updateOrder = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const { params, body } = parseRequest(updateOrderSchema, req);
    const serviceResponse = await astoreOrdersService.updateOrder(
      params.id,
      body,
      req.user!.id
    );
    return handleServiceResponse(serviceResponse, res);
  }
);
