import type { Request, Response } from "express";
import catchAsync from "@/shared/utils/catchAsync";
import {
  handleServiceResponse,
  parseRequest,
} from "@/shared/utils/httpHandlers";
import {
  deleteFromCloudinary,
  uploadToCloudinary,
} from "@/shared/utils/cloudinary";
import * as themesService from "./themes.service";
import {
  createThemeSchema,
  updateThemeSchema,
  themeIdSchema,
} from "./themes.schemas";

const CONFIG_SECTIONS = ["font_config", "corner_config", "wallpaper_config"];

/** Multipart clients send each config section as a JSON string. */
const parseMultipartSections = (body: Record<string, unknown>) => {
  for (const key of CONFIG_SECTIONS) {
    const value = body[key];
    if (typeof value !== "string") continue;
    try {
      body[key] = JSON.parse(value);
    } catch {
      // Leave as-is so validation reports the bad section
    }
  }
};

/**
 * Upload an attached wallpaper file to Cloudinary and point
 * wallpaper_config.image at it. Returns the URL so it can be cleaned up.
 */
const attachWallpaperUpload = async (req: Request) => {
  if (!req.file) return null;

  const { url } = await uploadToCloudinary(
    req.file.buffer,
    "wallpapers",
    req.file.mimetype
  );

  const current = req.body.wallpaper_config;
  const wallpaper =
    current && typeof current === "object" ? current : {};
  req.body.wallpaper_config = {
    ...wallpaper,
    type: wallpaper.type ?? "image",
    image: url,
  };

  return url;
};

/** Parse the body (with any uploaded wallpaper), save, and drop the upload on failure. */
const withWallpaperUpload = async <T>(
  req: Request,
  parse: () => T,
  save: (parsed: T) => ReturnType<typeof themesService.saveTheme>
) => {
  req.body ??= {};
  parseMultipartSections(req.body);
  const uploadedUrl = await attachWallpaperUpload(req);

  try {
    const serviceResponse = await save(parse());
    if (!serviceResponse.success && uploadedUrl) {
      void deleteFromCloudinary(uploadedUrl);
    }
    return serviceResponse;
  } catch (error) {
    if (uploadedUrl) void deleteFromCloudinary(uploadedUrl);
    throw error;
  }
};

export const index = catchAsync(async (_req: Request, res: Response) => {
  const serviceResponse = await themesService.getThemes();
  return handleServiceResponse(serviceResponse, res);
});

export const store = catchAsync(async (req: Request, res: Response) => {
  const serviceResponse = await withWallpaperUpload(
    req,
    () => parseRequest(createThemeSchema, req),
    ({ body }) => themesService.saveTheme(body)
  );
  return handleServiceResponse(serviceResponse, res);
});

export const show = catchAsync(async (req: Request, res: Response) => {
  const { params } = parseRequest(themeIdSchema, req);
  return handleServiceResponse(await themesService.getTheme(params.id), res);
});
export const update = catchAsync(async (req: Request, res: Response) => {
  const serviceResponse = await withWallpaperUpload(
    req,
    () => parseRequest(updateThemeSchema, req),
    ({ params, body }) => themesService.updateTheme(params.id, body)
  );
  return handleServiceResponse(serviceResponse, res);
});
export const destroy = catchAsync(async (req: Request, res: Response) => {
  const { params } = parseRequest(themeIdSchema, req);
  return handleServiceResponse(await themesService.deleteTheme(params.id), res);
});
