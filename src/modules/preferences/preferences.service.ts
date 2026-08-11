import cache from "@/lib/cache";
import {
  TUpdateBackground,
  TUpdateCorners,
  TUpdateFont,
  TUpdatePreferences,
} from "./preferences.schemas";
import { prisma } from "@/shared/config/database";
import { profileService } from "@/modules/profiles/profile.service";
import { ServiceResponse } from "@/shared/utils/serviceResponse";
import { DisplayPreference } from "@prisma/client";
import { StatusCodes } from "http-status-codes";

export const updateBackgroundPreferences = async (
  userId: string,
  data: TUpdateBackground
): Promise<ServiceResponse<DisplayPreference>> => {
  const profile = await profileService.getByUserId(userId);

  const prevSettings = await prisma.displayPreference.findUnique({
    where: { profileId: profile.data!.id },
  });

  const update = {
    ...((prevSettings?.wallpaper_config ?? {}) as object),
    ...data,
  };

  const settings = await prisma.displayPreference.upsert({
    where: {
      profileId: profile.data!.id,
    },
    update: {
      wallpaper_config: update,
    },
    create: {
      userId,
      profileId: profile.data!.id,
      wallpaper_config: update,
    },
    include: {
      profile: true,
    },
  });

  cache.del(`public_profiles:${settings.profile.username}`);

  return ServiceResponse.success(
    "Wallpaper settings updated successfully",
    settings,
    StatusCodes.OK
  );
};

export const updateFontPreferences = async (
  userId: string,
  data: TUpdateFont
): Promise<ServiceResponse<DisplayPreference>> => {
  const profile = await profileService.getByUserId(userId);
  const settings = await prisma.displayPreference.upsert({
    where: {
      profileId: profile.data!.id,
    },
    create: {
      profileId: profile.data!.id,
      userId,
      font_config: data,
    },
    update: {
      font_config: data,
    },
    include: {
      profile: true,
    },
  });

  cache.del(`public_profiles:${settings.profile.username}`);

  return ServiceResponse.success("Settings updated", settings);
};

export const updateCornerPreferences = async (
  userId: string,
  data: TUpdateCorners
): Promise<ServiceResponse<DisplayPreference>> => {
  const profile = await profileService.getByUserId(userId);
  const settings = await prisma.displayPreference.upsert({
    where: {
      profileId: profile.data!.id,
    },
    update: {
      corner_config: data,
    },
    create: {
      profileId: profile.data!.id,
      userId,
      corner_config: data,
    },
    include: {
      profile: true,
    },
  });

  cache.del(`public_profiles:${settings.profile.username}`);

  return ServiceResponse.success(
    "Corner settings updated successfully",
    settings,
    StatusCodes.OK
  );
};

export const getPreferences = async (userId: string) => {
  const settings = await prisma.displayPreference.findFirst({
    where: {
      userId,
    },
  });

  if (!settings) {
    const profile = await prisma.profile.findFirst({ where: { userId } });

    if (profile) {
      const pref = await prisma.displayPreference.create({
        data: {
          corner_config: {},
          font_config: {},
          userId,
          profileId: profile.id,
          wallpaper_config: {},
          selected_theme: null,
        },
      });

      return ServiceResponse.success("Settings generated", pref);
    }
  }

  return ServiceResponse.success(
    "Settings retrieved successfully",
    settings,
    200
  );
};

export const updatePreferences = async (
  userId: string,
  settingsData: TUpdatePreferences
) => {
  const profile = await profileService.getByUserId(userId);

  const settings = await prisma.displayPreference.upsert({
    where: {
      profileId: profile.data!.id,
    },
    update: {
      ...settingsData,
    },
    create: {
      profileId: profile.data!.id,
      userId,
      ...settingsData,
    },
    include: {
      profile: true,
    },
  });

  cache.del(`public_profiles:${settings.profile.username}`);

  return ServiceResponse.success(
    "Corner settings updated successfully",
    settings,
    StatusCodes.OK
  );
};
