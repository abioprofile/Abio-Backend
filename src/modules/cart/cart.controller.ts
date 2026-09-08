import type { Response } from "express";
import catchAsync from "@/shared/utils/catchAsync";
import {
  handleServiceResponse,
  parseRequest,
} from "@/shared/utils/httpHandlers";
import type { AuthenticatedRequest } from "@/shared/types/express";
import * as cartService from "./cart.service";
import {
  addCartItemSchema,
  updateCartItemSchema,
  cartItemIdParamSchema,
} from "./cart.schemas";

export const getCart = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const serviceResponse = await cartService.getCart(req.user!.id);
    return handleServiceResponse(serviceResponse, res);
  }
);

export const addCartItem = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const { body } = parseRequest(addCartItemSchema, req);
    const serviceResponse = await cartService.addCartItem(req.user!.id, body);
    return handleServiceResponse(serviceResponse, res);
  }
);

export const updateCartItem = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const { params, body } = parseRequest(updateCartItemSchema, req);
    const serviceResponse = await cartService.updateCartItem(
      req.user!.id,
      params.itemId,
      body
    );
    return handleServiceResponse(serviceResponse, res);
  }
);

export const removeCartItem = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const { params } = parseRequest(cartItemIdParamSchema, req);
    const serviceResponse = await cartService.removeCartItem(
      req.user!.id,
      params.itemId
    );
    return handleServiceResponse(serviceResponse, res);
  }
);

export const clearCart = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const serviceResponse = await cartService.clearCart(req.user!.id);
    return handleServiceResponse(serviceResponse, res);
  }
);
