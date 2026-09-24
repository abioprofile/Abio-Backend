import { StatusCodes } from "http-status-codes";
import { prisma } from "@/shared/config/database";
import { ServiceResponse } from "@/shared/utils/serviceResponse";
import cache from "@/lib/cache";
import type { TUpdateNotifications, TUpdatePrivacy } from "./settings.schemas";

/** GET /api/v1/user/settings/privacy */
export const getPrivacy = async (userId: string) => {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { isPublic: true },
  });

  if (!profile) {
    return ServiceResponse.failure(
      "Profile not found",
      null,
      StatusCodes.NOT_FOUND
    );
  }

  return ServiceResponse.success("Privacy settings retrieved", {
    visibility: profile.isPublic ? "public" : "private",
  });
};

/** PATCH /api/v1/user/settings/privacy */
export const updatePrivacy = async (
  userId: string,
  data: TUpdatePrivacy
) => {
  const existing = await prisma.profile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!existing) {
    return ServiceResponse.failure(
      "Profile not found",
      null,
      StatusCodes.NOT_FOUND
    );
  }

  const profile = await prisma.profile.update({
    where: { userId },
    data: { isPublic: data.visibility === "public" },
    select: { isPublic: true, username: true },
  });

  if (profile.username) {
    cache.del(`public_profiles:${profile.username}`);
  }

  return ServiceResponse.success("Privacy settings updated", {
    visibility: profile.isPublic ? "public" : "private",
  });
};

/** GET /api/v1/user/settings/notifications */
export const getNotifications = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notifyOnLinkTap: true },
  });

  if (!user) {
    return ServiceResponse.failure(
      "User not found",
      null,
      StatusCodes.NOT_FOUND
    );
  }

  return ServiceResponse.success("Notification settings retrieved", {
    emailOnLinkTap: user.notifyOnLinkTap,
  });
};

/** PATCH /api/v1/user/settings/notifications */
export const updateNotifications = async (
  userId: string,
  data: TUpdateNotifications
) => {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { notifyOnLinkTap: data.emailOnLinkTap },
    select: { notifyOnLinkTap: true },
  });

  return ServiceResponse.success("Notification settings updated", {
    emailOnLinkTap: user.notifyOnLinkTap,
  });
};
