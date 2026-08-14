import { prisma } from "@/shared/config/database";
import { TUpdateProfile } from "./profile.schemas";
import { ServiceResponse } from "@/shared/utils/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { AppError } from "@/shared/utils/appError";
import { ConflictError } from "@/shared/utils/errors";
import {
  deleteFromCloudinary,
  uploadToCloudinary,
} from "@/shared/utils/cloudinary";
import cache from "@/lib/cache";

const bustPublicProfileCache = async (username: string | null | undefined) => {
  if (username) {
    await cache.del(`public_profiles:${username}`);
  }
};

export const getByUserId = async (userId: string) => {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    include: {
      links: {
        orderBy: { displayOrder: "asc" },
      },
      display: true,
    },
  });

  if (!profile) {
    return ServiceResponse.failure(
      "Profile not found",
      null,
      StatusCodes.NOT_FOUND
    );
  }
  return ServiceResponse.success("Profile retrieved successfully", profile);
};

export const update = async (
  userId: string,
  data: TUpdateProfile & { displayName?: string }
) => {
  if (data.username) {
    const existingProfile = await prisma.profile.findUnique({
      where: { username: data.username },
    });

    if (existingProfile && existingProfile.userId !== userId) {
      throw new ConflictError("Username is already taken");
    }
  }

  if (data.displayName) {
    await prisma.user.update({
      where: { id: userId },
      data: { name: data.displayName },
    });
  }

  const profile = await prisma.profile.update({
    where: { userId },
    data: { ...data, displayName: undefined } as any,
    include: {
      links: {
        orderBy: { displayOrder: "asc" },
      },
      user: {
        select: { name: true },
      },
    },
  });

  if (profile?.username && profile.goals.length > 0) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        isOnboardingCompleted: true,
      },
    });
  }

  return ServiceResponse.success("Profile updated successfully", profile);
};

export const getPublicByUsername = async (username: string) => {
  const data = await cache.get(`public_profiles:${username}`);

  if (data) {
    return ServiceResponse.success(
      "Profile retrieved successfully",
      JSON.parse(data)
    );
  }

  const profile = await prisma.profile.findUnique({
    where: { username, isPublic: true },
    select: {
      id: true,
      userId: true,
      username: true,
      bio: true,
      location: true,
      avatarUrl: true,
      isPublic: true,
      createdAt: true,
      updatedAt: true,
      links: {
        where: { isVisible: true },
        orderBy: { displayOrder: "asc" },
      },
      user: {
        select: { name: true },
      },
      display: true,
    },
  });

  if (!profile) {
    throw new AppError(
      "Profile not found or is private",
      StatusCodes.NOT_FOUND
    );
  }

  cache.setex(
    `public_profiles:${username}`,
    60 * 60,
    JSON.stringify(profile)
  );
  return ServiceResponse.success("Profile retrieved successfully", profile);
};

export const checkUsernameAvailability = async (username: string) => {
  const existingProfile = await prisma.profile.findUnique({
    where: { username },
    select: { id: true },
  });

  const isAvailable = !existingProfile;

  return ServiceResponse.success(
    isAvailable ? "Username is available" : "Username is already taken",
    {
      username,
      isAvailable,
      isValid: true,
    }
  );
};

export const updateAvatar = async (
  userId: string,
  fileBuffer: Buffer,
  mimetype?: string
) => {
  const existing = await prisma.profile.findUnique({
    where: { userId },
    select: { avatarUrl: true, username: true },
  });

  const { url } = await uploadToCloudinary(fileBuffer, "avatars", mimetype);

  const profile = await prisma.profile.update({
    where: { userId },
    data: { avatarUrl: url },
    include: {
      links: {
        orderBy: { displayOrder: "asc" },
      },
    },
  });

  if (existing?.avatarUrl) {
    void deleteFromCloudinary(existing.avatarUrl);
  }
  await bustPublicProfileCache(profile.username);

  return ServiceResponse.success("Avatar updated successfully", profile);
};

export const deleteAvatar = async (userId: string) => {
  const existing = await prisma.profile.findUnique({
    where: { userId },
    select: { avatarUrl: true, username: true },
  });

  if (!existing) {
    return ServiceResponse.failure(
      "Profile not found",
      null,
      StatusCodes.NOT_FOUND
    );
  }

  if (!existing.avatarUrl) {
    return ServiceResponse.success("No avatar to remove", {
      avatarUrl: null,
    });
  }

  const profile = await prisma.profile.update({
    where: { userId },
    data: { avatarUrl: null },
    include: {
      links: {
        orderBy: { displayOrder: "asc" },
      },
    },
  });

  void deleteFromCloudinary(existing.avatarUrl);
  await bustPublicProfileCache(existing.username);

  return ServiceResponse.success("Avatar removed successfully", profile);
};

/** Compatibility object for callers that used profileService.* */
export const profileService = {
  getByUserId,
  update,
  getPublicByUsername,
  checkUsernameAvailability,
  updateAvatar,
  deleteAvatar,
};
