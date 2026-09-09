import type { Request, Response } from "express";
import catchAsync from "@/shared/utils/catchAsync";
import {
  handleServiceResponse,
  parseRequest,
} from "@/shared/utils/httpHandlers";
import * as themesService from "./themes.service";
import {
  createThemeSchema,
  updateThemeSchema,
  themeIdSchema,
} from "./themes.schemas";

export const index = catchAsync(async (_req: Request, res: Response) => {
  const serviceResponse = await themesService.getThemes();
  return handleServiceResponse(serviceResponse, res);
});

export const store = catchAsync(async (req: Request, res: Response) => {
  const { body } = parseRequest(createThemeSchema, req);
  const serviceResponse = await themesService.saveTheme(body);
  return handleServiceResponse(serviceResponse, res);
});

export const show = catchAsync(async (req: Request, res: Response) => {
  const { params } = parseRequest(themeIdSchema, req);
  return handleServiceResponse(await themesService.getTheme(params.id), res);
});
export const update = catchAsync(async (req: Request, res: Response) => {
  const { params, body } = parseRequest(updateThemeSchema, req);
  return handleServiceResponse(
    await themesService.updateTheme(params.id, body),
    res,
  );
});
export const destroy = catchAsync(async (req: Request, res: Response) => {
  const { params } = parseRequest(themeIdSchema, req);
  return handleServiceResponse(await themesService.deleteTheme(params.id), res);
});
