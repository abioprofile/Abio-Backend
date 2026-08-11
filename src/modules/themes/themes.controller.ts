import type { Request, Response } from "express";
import catchAsync from "@/shared/utils/catchAsync";
import {
  handleServiceResponse,
  parseRequest,
} from "@/shared/utils/httpHandlers";
import * as themesService from "./themes.service";
import { createThemeSchema } from "./themes.schemas";

export const index = catchAsync(async (_req: Request, res: Response) => {
  const serviceResponse = await themesService.getThemes();
  return handleServiceResponse(serviceResponse, res);
});

export const store = catchAsync(async (req: Request, res: Response) => {
  const { body } = parseRequest(createThemeSchema, req);
  const serviceResponse = await themesService.saveTheme(body);
  return handleServiceResponse(serviceResponse, res);
});
