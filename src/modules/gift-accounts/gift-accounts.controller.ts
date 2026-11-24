import type { NextFunction, Request, Response } from "express";
import catchAsync from "@/shared/utils/catchAsync";
import {
  handleServiceResponse,
  parseRequest,
} from "@/shared/utils/httpHandlers";
import AppError from "@/shared/utils/appError";
import type { Prisma } from "@prisma/client";
import type { ServiceResponse } from "@/shared/utils/serviceResponse";
import type { AuthenticatedRequest } from "@/shared/types/express";
import * as profileService from "@/modules/profiles/profile.service";
import { updateProfileSchema } from "@/modules/profiles/profile.schemas";
import * as linkService from "@/modules/links/link.service";
import {
  createLinkSchema,
  reorderLinksSchema,
  updateLinkSchema,
} from "@/modules/links/link.schemas";
import * as preferencesService from "@/modules/preferences/preferences.service";
import { updatePreferencesSchema } from "@/modules/preferences/preferences.schemas";
import * as giftService from "./gift-accounts.service";
import {
  createGiftAccountSchema,
  giftAccountParamsSchema,
  giftLinkParamsSchema,
  issueClaimLinkSchema,
  isReservedUsername,
  listGiftAccountsSchema,
} from "./gift-accounts.schemas";

const actorId = (req: Request) => (req as AuthenticatedRequest).user.id;

/**
 * Route guard for every staff edit: the target must be an unclaimed gift
 * account. Regular users (404) and claimed gifts (409) are rejected.
 */
export const requireEditableGiftAccount = catchAsync(
  async (req: Request, _res: Response, next: NextFunction) => {
    const { params } = parseRequest(giftAccountParamsSchema, req);
    await giftService.beginStaffEdit(params.userId);
    next();
  }
);

/** Audit a staff edit only when the underlying service succeeded. */
const auditIfOk = async (
  response: ServiceResponse<unknown>,
  req: Request,
  userId: string,
  action: string,
  metadata?: Record<string, unknown>
) => {
  if (!response.success) return;
  await giftService.recordGiftAudit(
    actorId(req),
    userId,
    action,
    metadata as Prisma.InputJsonObject | undefined
  );
};

/* ------------------------------ Accounts ------------------------------ */

export const create = catchAsync(async (req: Request, res: Response) => {
  const { body } = parseRequest(createGiftAccountSchema, req);
  const response = await giftService.createGiftAccount(body, actorId(req));
  return handleServiceResponse(response, res);
});

export const list = catchAsync(async (req: Request, res: Response) => {
  const { query } = parseRequest(listGiftAccountsSchema, req);
  const response = await giftService.listGiftAccounts(query);
  return handleServiceResponse(response, res);
});

export const getOne = catchAsync(async (req: Request, res: Response) => {
  const { params } = parseRequest(giftAccountParamsSchema, req);
  const response = await giftService.getGiftAccount(params.userId);
  return handleServiceResponse(response, res);
});

export const issueClaimLink = catchAsync(async (req: Request, res: Response) => {
  const { params, body } = parseRequest(issueClaimLinkSchema, req);
  const response = await giftService.issueClaimLink(
    params.userId,
    body,
    actorId(req)
  );
  return handleServiceResponse(response, res);
});

export const remove = catchAsync(async (req: Request, res: Response) => {
  const { params } = parseRequest(giftAccountParamsSchema, req);
  const response = await giftService.deleteGiftAccount(params.userId, actorId(req));
  return handleServiceResponse(response, res);
});

/* ------------------------------- Profile ------------------------------ */

export const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const { params } = parseRequest(giftAccountParamsSchema, req);
  const { body } = parseRequest(updateProfileSchema, req);
  if (body.username && isReservedUsername(body.username)) {
    throw new AppError("This username is reserved. Please choose another.", 400);
  }
  const response = await profileService.update(params.userId, body);
  await auditIfOk(response, req, params.userId, "profile.update", {
    fields: Object.keys(body),
  });
  return handleServiceResponse(response, res);
});

export const updateAvatar = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { params } = parseRequest(giftAccountParamsSchema, req);
    if (!req.file) return next(new AppError("Please upload an image", 400));
    const response = await profileService.updateAvatar(
      params.userId,
      req.file.buffer,
      req.file.mimetype
    );
    await auditIfOk(response, req, params.userId, "avatar.update");
    return handleServiceResponse(response, res);
  }
);

export const deleteAvatar = catchAsync(async (req: Request, res: Response) => {
  const { params } = parseRequest(giftAccountParamsSchema, req);
  const response = await profileService.deleteAvatar(params.userId);
  await auditIfOk(response, req, params.userId, "avatar.delete");
  return handleServiceResponse(response, res);
});

/* ---------------------------- Theme/display --------------------------- */

export const getPreferences = catchAsync(async (req: Request, res: Response) => {
  const { params } = parseRequest(giftAccountParamsSchema, req);
  const response = await preferencesService.getPreferences(params.userId);
  return handleServiceResponse(response, res);
});

export const updatePreferences = catchAsync(
  async (req: Request, res: Response) => {
    const { params } = parseRequest(giftAccountParamsSchema, req);
    const { body } = parseRequest(updatePreferencesSchema, req);
    const response = await preferencesService.updatePreferences(
      params.userId,
      body
    );
    await auditIfOk(
      response,
      req,
      params.userId,
      "preferences.update",
      { fields: Object.keys(body) }
    );
    return handleServiceResponse(response, res);
  }
);

export const uploadWallpaper = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { params } = parseRequest(giftAccountParamsSchema, req);
    if (!req.file) return next(new AppError("Please upload an image", 400));
    const response = await preferencesService.uploadWallpaperImage(
      params.userId,
      req.file.buffer,
      req.file.mimetype
    );
    return handleServiceResponse(response, res);
  }
);

/* -------------------------------- Links ------------------------------- */

export const listLinks = catchAsync(async (req: Request, res: Response) => {
  const { params } = parseRequest(giftAccountParamsSchema, req);
  const response = await linkService.getAllByUserId(params.userId);
  return handleServiceResponse(response, res);
});

export const createLink = catchAsync(async (req: Request, res: Response) => {
  const { params } = parseRequest(giftAccountParamsSchema, req);
  const { body } = parseRequest(createLinkSchema, req);
  const response = await linkService.create(params.userId, body);
  await auditIfOk(response, req, params.userId, "link.create", {
    linkId: (response.data as { id?: string } | null)?.id ?? null,
  });
  return handleServiceResponse(response, res);
});

export const reorderLinks = catchAsync(async (req: Request, res: Response) => {
  const { params } = parseRequest(giftAccountParamsSchema, req);
  const { body } = parseRequest(reorderLinksSchema, req);
  const response = await linkService.reorder(params.userId, body);
  await auditIfOk(response, req, params.userId, "link.reorder");
  return handleServiceResponse(response, res);
});

export const updateLink = catchAsync(async (req: Request, res: Response) => {
  const { params } = parseRequest(giftLinkParamsSchema, req);
  const { body } = parseRequest(updateLinkSchema, req);
  // Link service scopes by owner, so a link of another user returns 404.
  const response = await linkService.update(params.linkId, params.userId, body);
  await auditIfOk(response, req, params.userId, "link.update", {
    linkId: params.linkId,
    fields: Object.keys(body),
  });
  return handleServiceResponse(response, res);
});

export const updateLinkIcon = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { params } = parseRequest(giftLinkParamsSchema, req);
    if (!req.file) {
      return next(new AppError("Please provide an image for the icon", 400));
    }
    const response = await linkService.updateLinkIcon(
      params.linkId,
      params.userId,
      req.file.buffer,
      req.file.mimetype
    );
    await auditIfOk(response, req, params.userId, "link.icon", {
      linkId: params.linkId,
    });
    return handleServiceResponse(response, res);
  }
);

export const deleteLink = catchAsync(async (req: Request, res: Response) => {
  const { params } = parseRequest(giftLinkParamsSchema, req);
  const response = await linkService.deleteLink(params.linkId, params.userId);
  await auditIfOk(response, req, params.userId, "link.delete", {
    linkId: params.linkId,
  });
  return handleServiceResponse(response, res);
});
