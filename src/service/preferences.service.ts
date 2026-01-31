import {
  TUpdateBackground,
  TUpdateCorners,
  TUpdateFont,
} from "@/schemas/profile.schema";
import { prisma } from "@/server";
import { profileService } from "@/service/profile.service";
import { ServiceResponse } from "@/utils/serviceResponse";
import { DisplayPreference } from "@prisma/client";
import { StatusCodes } from "http-status-codes";

// user display preferences
class PreferenceService {
  async updateBackgroundPreferences(
    userId: string,
    data: TUpdateBackground,
  ): Promise<ServiceResponse<DisplayPreference>> {
    const profile = await profileService.getByUserId(userId);

    // Preserve some of the previous settings that haven't been changed.
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
      }
    });

    return ServiceResponse.success(
      "Wallpaper settings updated successfully",
      settings,
      StatusCodes.OK,
    );
  }

  async updateFontPreferences(
    userId: string,
    data: TUpdateFont,
  ): Promise<ServiceResponse<DisplayPreference>> {
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
    });

    return ServiceResponse.success("Settings updated", settings);
  }

  async updateCornerPreferences(
    userId: string,
    data: TUpdateCorners,
  ): Promise<ServiceResponse<DisplayPreference>> {
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
    });

    return ServiceResponse.success(
      "Corner settings updated successfully",
      settings,
      StatusCodes.OK,
    );
  }

  async getPreferences(userId: string) {
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
      200,
    );
  }
}

export default new PreferenceService();
