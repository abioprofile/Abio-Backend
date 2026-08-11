import type { Request, Response } from "express";
import catchAsync from "@/shared/utils/catchAsync";
import {
  handleServiceResponse,
  parseRequest,
} from "@/shared/utils/httpHandlers";
import * as waitlistService from "./waitlist.service";
import { createWaitlistSchema } from "./waitlist.schemas";

export const create = catchAsync(async (req: Request, res: Response) => {
  const { body } = parseRequest(createWaitlistSchema, req);
  const serviceResponse = await waitlistService.create(body);
  return handleServiceResponse(serviceResponse, res);
});

export const getAll = catchAsync(async (_req: Request, res: Response) => {
  const serviceResponse = await waitlistService.getAll();
  return handleServiceResponse(serviceResponse, res);
});
