import themesService from "@/service/themes.service";
import { AuthenticatedRequest } from "@/types/express";
import catchAsync from "@/utils/catchAsync";
import { handleServiceResponse } from "@/utils/httpHandlers";
import { ServiceResponse } from "@/utils/serviceResponse";
import { RequestHandler, Response } from "express";

export default class ThemeController {
  public static index: RequestHandler = catchAsync(async function (
    req: AuthenticatedRequest,
    res: Response,
  ) {
    const r = await themesService.getThemes();
    return handleServiceResponse(r, res);
  });

  public static store: RequestHandler = catchAsync(async function (
    req: AuthenticatedRequest,
    res: Response,
  ) {
    const r = await themesService.saveTheme(req.body);
    return handleServiceResponse(r, res);
  });
}
