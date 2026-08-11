import { prisma } from "@/shared/config/database";
import { ServiceResponse } from "@/shared/utils/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { AppError } from "@/shared/utils/appError";
import {
  ConflictError,
  NotFoundError,
} from "@/shared/utils/errors";
import { SOCIAL_PLATFORMS } from "@/shared/utils/constants";
import { uploadToCloudinary } from "@/shared/utils/cloudinary";
import type {
  TCreateLink,
  TUpdateLink,
  TReorderLinks,
} from "./link.schemas";

/** Exported for unit tests — returns SOCIAL_PLATFORMS key uppercased, or null. */
export const detectPlatform = (url: string): string | null => {
  for (const [key, platform] of Object.entries(SOCIAL_PLATFORMS)) {
    if (platform.urlPattern.test(url)) {
      return key.toUpperCase();
    }
  }
  return null;
};

export const create = async (userId: string, data: TCreateLink) => {
  const profile = await prisma.profile.findUnique({
    where: { userId },
  });

  if (!profile) {
    throw new NotFoundError("Profile");
  }

  const existingLink = await prisma.link.findFirst({
    where: {
      profileId: profile.id,
      url: data.url,
    },
  });

  if (existingLink) {
    throw new ConflictError("You already have a link with this URL");
  }

  const maxOrder = await prisma.link.findFirst({
    where: { profileId: profile.id },
    orderBy: { displayOrder: "desc" },
    select: { displayOrder: true },
  });

  const detectedPlatform = detectPlatform(data.url);
  const platform = detectedPlatform || data.platform || null;

  const link = await prisma.link.create({
    data: {
      title: data.title,
      url: data.url,
      platform,
      isVisible: data.isVisible ?? true,
      profileId: profile.id,
      displayOrder: (maxOrder?.displayOrder ?? -1) + 1,
    },
  });

  return ServiceResponse.success(
    "Link created successfully",
    link,
    StatusCodes.CREATED
  );
};

export const getAllByUserId = async (userId: string) => {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    include: {
      links: {
        orderBy: { displayOrder: "asc" },
      },
    },
  });

  if (!profile) {
    throw new NotFoundError("Profile");
  }

  return ServiceResponse.success(
    "Links retrieved successfully",
    profile.links
  );
};

export const getById = async (linkId: string, userId: string) => {
  const link = await prisma.link.findFirst({
    where: {
      id: linkId,
      profile: { userId },
    },
  });

  if (!link) {
    throw new AppError(
      "Link not found or you don't have permission",
      StatusCodes.NOT_FOUND
    );
  }

  return ServiceResponse.success("Link retrieved successfully", link);
};

export const update = async (
  linkId: string,
  userId: string,
  data: TUpdateLink
) => {
  const link = await prisma.link.findFirst({
    where: {
      id: linkId,
      profile: { userId },
    },
    include: {
      profile: true,
    },
  });

  if (!link) {
    throw new AppError(
      "Link not found or you don't have permission",
      StatusCodes.NOT_FOUND
    );
  }

  if (data.url && data.url !== link.url) {
    const existingLink = await prisma.link.findFirst({
      where: {
        profileId: link.profileId,
        url: data.url,
        id: { not: linkId },
      },
    });

    if (existingLink) {
      throw new ConflictError("You already have a link with this URL");
    }
  }

  const updateData: Record<string, unknown> = { ...data };
  if (data.url) {
    const detectedPlatform = detectPlatform(data.url);
    updateData.platform = detectedPlatform || data.platform || null;
  } else if (data.platform) {
    updateData.platform = data.platform;
  }

  const updatedLink = await prisma.link.update({
    where: { id: linkId },
    data: updateData,
  });

  return ServiceResponse.success("Link updated successfully", updatedLink);
};

export const deleteLink = async (linkId: string, userId: string) => {
  const link = await prisma.link.findFirst({
    where: {
      id: linkId,
      profile: { userId },
    },
  });

  if (!link) {
    throw new AppError(
      "Link not found or you don't have permission",
      StatusCodes.NOT_FOUND
    );
  }

  await prisma.link.delete({
    where: { id: linkId },
  });

  return ServiceResponse.success("Link deleted successfully", null);
};

export const reorder = async (userId: string, data: TReorderLinks) => {
  const profile = await prisma.profile.findUnique({
    where: { userId },
  });

  if (!profile) {
    throw new NotFoundError("Profile");
  }

  const linkIds = data.links.map((l) => l.id);
  const existingLinks = await prisma.link.findMany({
    where: {
      id: { in: linkIds },
      profileId: profile.id,
    },
    select: { id: true },
  });

  if (existingLinks.length !== linkIds.length) {
    throw new AppError(
      "One or more links not found or don't belong to you",
      StatusCodes.BAD_REQUEST
    );
  }

  await prisma.$transaction(
    data.links.map(({ id, displayOrder }) =>
      prisma.link.update({
        where: { id },
        data: { displayOrder },
      })
    )
  );

  return ServiceResponse.success("Links reordered successfully", null);
};

export const trackClick = async (linkId: string) => {
  const link = await prisma.link.findUnique({
    where: { id: linkId },
  });

  if (!link) {
    throw new NotFoundError("Link");
  }

  await prisma.link.update({
    where: { id: linkId },
    data: {
      clickCount: { increment: 1 },
    },
  });

  return ServiceResponse.success("Click tracked", null);
};

export const updateLinkIcon = async (
  linkId: string,
  file: Buffer<ArrayBufferLike>
) => {
  try {
    const uploaded = await uploadToCloudinary(file, "icon_urls");

    const data = await prisma.link.update({
      where: { id: linkId },
      data: {
        icon_link: uploaded.url,
      },
    });

    return ServiceResponse.success("", data);
  } catch (error: any) {
    console.error(error);
    return ServiceResponse.failure(error.message, null, 500);
  }
};
