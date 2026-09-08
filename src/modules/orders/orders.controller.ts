import type { Response } from "express";
import catchAsync from "@/shared/utils/catchAsync";
import {
  handleServiceResponse,
  parseRequest,
} from "@/shared/utils/httpHandlers";
import type { AuthenticatedRequest } from "@/shared/types/express";
import * as ordersService from "./orders.service";
import {
  checkoutSchema,
  listOrdersSchema,
  orderIdParamSchema,
} from "./orders.schemas";

export const checkout = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const { body } = parseRequest(checkoutSchema, req);
    const serviceResponse = await ordersService.checkout(req.user!.id, body);
    return handleServiceResponse(serviceResponse, res);
  }
);

export const listMyOrders = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const { query } = parseRequest(listOrdersSchema, req);
    const serviceResponse = await ordersService.listMyOrders(
      req.user!.id,
      query
    );
    return handleServiceResponse(serviceResponse, res);
  }
);

export const getMyOrderById = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const { params } = parseRequest(orderIdParamSchema, req);
    const serviceResponse = await ordersService.getMyOrderById(
      req.user!.id,
      params.id
    );
    return handleServiceResponse(serviceResponse, res);
  }
);
