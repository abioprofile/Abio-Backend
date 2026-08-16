import cache from "@/lib/cache";
import type { TUpdatePreferences } from "./preferences.schemas";
import { prisma } from "@/shared/config/database";
import { profileService } from "@/modules/profiles/profile.service";
import { ServiceResponse } from "@/shared/utils/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { uploadToCloudinary } from "@/shared/utils/cloudinary";
import AppError from "@/shared/utils/appError";

const bustCache = (username: string | null | undefined) => {
  if (username) cache.del(`public_profiles:${username}`);
};

export const getPreferences = async (userId: string) => {
  const settings = await prisma.displayPreference.findFirst({
    where: { userId },
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
    StatusCodes.OK
  );
};

/**
 * Save Changes — replace provided sections on display preferences.
 * Omitting a section leaves it unchanged.
 */
export const updatePreferences = async (
  userId: string,
  settingsData: TUpdatePreferences
) => {
  const profile = await profileService.getByUserId(userId);

  if (!profile.data) {
    throw new AppError("Profile not found", StatusCodes.NOT_FOUND);
  }

  const settings = await prisma.displayPreference.upsert({
    where: { profileId: profile.data.id },
    update: { ...settingsData },
    create: {
      profileId: profile.data.id,
      userId,
      font_config: settingsData.font_config ?? {},
      corner_config: settingsData.corner_config ?? {},
      wallpaper_config: settingsData.wallpaper_config ?? {},
      selected_theme: settingsData.selected_theme ?? null,
    },
    include: { profile: true },
  });

  bustCache(settings.profile.username);

  return ServiceResponse.success(
    "Preferences updated successfully",
    settings,
    StatusCodes.OK
  );
};

/** Upload wallpaper image → return CDN URL for wallpaper_config.image */
export const uploadWallpaperImage = async (
  userId: string,
  fileBuffer: Buffer,
  mimetype?: string
) => {
  // Ensure prefs row exists
  await getPreferences(userId);

  const { url, publicId } = await uploadToCloudinary(
    fileBuffer,
    "wallpapers",
    mimetype
  );

  return ServiceResponse.success(
    "Wallpaper image uploaded successfully",
    { url, publicId },
    StatusCodes.OK
  );
};

export const preferencesService = {
  getPreferences,
  updatePreferences,
  uploadWallpaperImage,
};
