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
  ): Promise<ServiceResponse> {
    return ServiceResponse.failure("", null, StatusCodes.NOT_IMPLEMENTED);
  }

  async updateFontPreferences(
    userId: string,
    data: TUpdateFont,
  ): Promise<ServiceResponse<DisplayPreference>> {
    const profile = await profileService.getByUserId(userId);
    const settings = await prisma.displayPreference.update({
        where: {
            profileId: profile.data!.id
        },
        data: {
            font_config: data,
        }
    });

    return ServiceResponse.success("Settings updated", settings);
  }

  async updateCornerPreferences(
    userId: string,
    data: TUpdateCorners,
  ): Promise<ServiceResponse> {
    return ServiceResponse.failure("", null, StatusCodes.NOT_IMPLEMENTED);
  }

  async getPreferences(userId: string) {
    const settings = await prisma.displayPreference.findFirst({
        where: {
            userId,
        }
    });

    if (!settings) {
        const profile = await prisma.profile.findFirst({where: {userId,}});

        if (profile) {
            const pref = await prisma.displayPreference.create({
                data: {
                    corner_config: {},
                    font_config: {},
                    userId,
                    profileId: profile.id,
                    wallpaper_config: {},
                    selected_theme: null,
                }
            });

            return ServiceResponse.success("Settings generated", pref);
        }
    }

    return ServiceResponse.success("Settings retrieved successfully", settings, 200);
  }
}

export default new PreferenceService();
