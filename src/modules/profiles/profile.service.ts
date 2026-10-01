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

const PUBLIC_PROFILE_TTL_SECONDS = 60 * 60;

const publicProfileKey = (username: string) => `public_profiles:${username}`;
const publicProfileVersionKey = (username: string) =>
  `public_profiles_version:${username}`;

/**
 * Call after the DB write has committed. Bumping the version rejects any
 * entry a concurrent reader computed from pre-update data and writes late.
 */
export const bustPublicProfileCache = async (
  username: string | null | undefined
) => {
  if (username) {
    await Promise.all([
      cache.incr(publicProfileVersionKey(username)),
      cache.del(publicProfileKey(username)),
    ]);
  }
};

export const getByUserId = async (userId: string) => {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    include: {
      links: {
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
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

  const previous = await prisma.profile.findUnique({
    where: { userId },
    select: { username: true },
  });

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
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
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

  await bustPublicProfileCache(previous?.username);
  if (profile.username !== previous?.username) {
    await bustPublicProfileCache(profile.username);
  }

  return ServiceResponse.success("Profile updated successfully", profile);
};

export const getPublicByUsername = async (username: string) => {
  const [cached, storedVersion] = await cache.mget(
    publicProfileKey(username),
    publicProfileVersionKey(username)
  );
  // Read the version before the DB so the entry we write is tagged with it
  const version = storedVersion ?? "0";

  if (cached) {
    const entry = JSON.parse(cached);
    if (entry?.v === version) {
      return ServiceResponse.success(
        "Profile retrieved successfully",
        entry.data
      );
    }
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
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
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
    publicProfileKey(username),
    PUBLIC_PROFILE_TTL_SECONDS,
    JSON.stringify({ v: version, data: profile })
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
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
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
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
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
