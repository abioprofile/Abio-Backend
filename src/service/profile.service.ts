import { prisma } from "@/server";
import { TUpdateProfile } from "@/schemas/profile.schema";
import { ServiceResponse } from "@/utils/serviceResponse";
import { StatusCodes } from "http-status-codes";

export class ProfileService {
  async getByUserId(userId: string) {
    const profile = await prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return ServiceResponse.failure(
        "Profile not found",
        null,
        StatusCodes.NOT_FOUND
      );
    }
    return ServiceResponse.success("Profile found", profile);
  }
}

export const profileService = new ProfileService();
