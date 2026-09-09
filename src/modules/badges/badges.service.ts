import { StatusCodes } from "http-status-codes";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/shared/config/database";
import {
  getPagination,
  getTotalPages,
} from "@/shared/utils/pagination";
import { ServiceResponse } from "@/shared/utils/serviceResponse";
import { uploadToCloudinary } from "@/shared/utils/cloudinary";
import type {
  TCreateBadgeRequestBody,
  TListBadgeRequestsQuery,
  TRejectBadgeRequestBody,
} from "./badges.schemas";

/** Interactive `$transaction` client from our extended Prisma instance */
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const requestSelect = {
  id: true,
  userId: true,
  badgeType: true,
  status: true,
  reason: true,
  idDocumentUrl: true,
  reviewedAt: true,
  reviewedById: true,
  reviewNote: true,
  createdAt: true,
  updatedAt: true,
} as const;

const badgeSelect = {
  id: true,
  badgeType: true,
  assignedAt: true,
  assignedById: true,
  revokedAt: true,
  revokedById: true,
  revokeReason: true,
} as const;

const grantActiveBadge = async (
  tx: Tx,
  userId: string,
  badgeType: string,
  actorId: string
) => {
  return tx.verificationBadge.upsert({
    where: {
      userId_badgeType: { userId, badgeType },
    },
    create: {
      userId,
      badgeType,
      assignedById: actorId,
    },
    update: {
      revokedAt: null,
      revokedById: null,
      revokeReason: null,
      assignedById: actorId,
      assignedAt: new Date(),
    },
    select: badgeSelect,
  });
};

/** POST /api/v1/user/badges/requests — multipart: reason + idDocument */
export const createBadgeRequest = async (
  userId: string,
  body: TCreateBadgeRequestBody,
  file: Express.Multer.File
) => {
  const badgeType = body.badgeType ?? "verified";

  const activeBadge = await prisma.verificationBadge.findFirst({
    where: { userId, badgeType, revokedAt: null },
    select: { id: true },
  });
  if (activeBadge) {
    return ServiceResponse.failure(
      "You already have an active verification badge",
      null,
      StatusCodes.CONFLICT
    );
  }

  const pending = await prisma.badgeRequest.findFirst({
    where: { userId, badgeType, status: "pending" },
    select: { id: true },
  });
  if (pending) {
    return ServiceResponse.failure(
      "You already have a pending verification request",
      null,
      StatusCodes.CONFLICT
    );
  }

  const uploaded = await uploadToCloudinary(
    file.buffer,
    "badge-id-documents",
    file.mimetype
  );

  const created = await prisma.badgeRequest.create({
    data: {
      userId,
      badgeType,
      reason: body.reason,
      idDocumentUrl: uploaded.url,
      status: "pending",
    },
    select: requestSelect,
  });

  return ServiceResponse.success(
    "Verification request submitted successfully",
    created,
    StatusCodes.CREATED
  );
};

/** GET /api/v1/user/badges/requests/me */
export const getMyBadgeStatus = async (userId: string) => {
  const [latestRequest, activeBadge] = await Promise.all([
    prisma.badgeRequest.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: requestSelect,
    }),
    prisma.verificationBadge.findFirst({
      where: { userId, badgeType: "verified", revokedAt: null },
      select: badgeSelect,
    }),
  ]);

  return ServiceResponse.success("Badge status retrieved successfully", {
    latestRequest,
    activeBadge,
    hasActiveBadge: Boolean(activeBadge),
  });
};

/** GET /api/v1/admin/badge-requests */
export const listBadgeRequests = async (query: TListBadgeRequestsQuery) => {
  const { page, limit, skip } = getPagination(query as Record<string, unknown>);
  const where: Prisma.BadgeRequestWhereInput = {};

  if (query.status) {
    where.status = query.status;
  }

  const [total, requests] = await Promise.all([
    prisma.badgeRequest.count({ where }),
    prisma.badgeRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        ...requestSelect,
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    }),
  ]);

  return ServiceResponse.success("Badge requests retrieved successfully", {
    requests,
    pagination: {
      page,
      limit,
      total,
      totalPages: getTotalPages(total, limit),
    },
  });
};

/** POST /api/v1/admin/badge-requests/:id/approve */
export const approveBadgeRequest = async (requestId: string, actorId: string) => {
  const existing = await prisma.badgeRequest.findUnique({
    where: { id: requestId },
    select: requestSelect,
  });

  if (!existing) {
    return ServiceResponse.failure(
      "Badge request not found",
      null,
      StatusCodes.NOT_FOUND
    );
  }

  if (existing.status !== "pending") {
    return ServiceResponse.failure(
      "Only pending requests can be approved",
      null,
      StatusCodes.CONFLICT
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const request = await tx.badgeRequest.update({
      where: { id: requestId },
      data: {
        status: "approved",
        reviewedAt: new Date(),
        reviewedById: actorId,
        reviewNote: null,
      },
      select: {
        ...requestSelect,
        user: { select: { id: true, email: true, name: true } },
      },
    });

    const badge = await grantActiveBadge(
      tx,
      existing.userId,
      existing.badgeType,
      actorId
    );

    await tx.adminAuditLog.create({
      data: {
        adminId: actorId,
        action: "badge.request.approve",
        resourceType: "badge_request",
        resourceId: requestId,
        oldValue: { status: existing.status },
        newValue: {
          status: "approved",
          userId: existing.userId,
          badgeId: badge.id,
        },
      },
    });

    return { request, badge };
  });

  return ServiceResponse.success("Badge request approved", result);
};

/** POST /api/v1/admin/badge-requests/:id/reject */
export const rejectBadgeRequest = async (
  requestId: string,
  body: TRejectBadgeRequestBody,
  actorId: string
) => {
  const existing = await prisma.badgeRequest.findUnique({
    where: { id: requestId },
    select: requestSelect,
  });

  if (!existing) {
    return ServiceResponse.failure(
      "Badge request not found",
      null,
      StatusCodes.NOT_FOUND
    );
  }

  if (existing.status !== "pending") {
    return ServiceResponse.failure(
      "Only pending requests can be rejected",
      null,
      StatusCodes.CONFLICT
    );
  }

  const request = await prisma.$transaction(async (tx) => {
    const updated = await tx.badgeRequest.update({
      where: { id: requestId },
      data: {
        status: "rejected",
        reviewedAt: new Date(),
        reviewedById: actorId,
        reviewNote: body.reason ?? null,
      },
      select: {
        ...requestSelect,
        user: { select: { id: true, email: true, name: true } },
      },
    });

    await tx.adminAuditLog.create({
      data: {
        adminId: actorId,
        action: "badge.request.reject",
        resourceType: "badge_request",
        resourceId: requestId,
        oldValue: { status: existing.status },
        newValue: {
          status: "rejected",
          reviewNote: updated.reviewNote,
        },
      },
    });

    return updated;
  });

  return ServiceResponse.success("Badge request rejected", request);
};
