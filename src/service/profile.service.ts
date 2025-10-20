import { prisma } from "@/server";
import { TUpdateProfile } from "@/schemas/profile.schema";
import { ServiceResponse } from "@/utils/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { AppError } from "@/utils/appError";

export class ProfileService {
  async getByUserId(userId: string) {
    const profile = await prisma.profile.findUnique({
      where: { userId },
      include: {
        links: {
          orderBy: { displayOrder: "asc" },
        },
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
  }

  async update(userId: string, data: TUpdateProfile) {
    // Check if username is being updated and if it's already taken
    if (data.username) {
      const existingProfile = await prisma.profile.findUnique({
        where: { username: data.username },
      });

      if (existingProfile && existingProfile.userId !== userId) {
        throw new AppError("Username is already taken", StatusCodes.CONFLICT);
      }
    }

    const profile = await prisma.profile.update({
      where: { userId },
      data,
      include: {
        links: {
          orderBy: { displayOrder: "asc" },
        },
      },
    });

    return ServiceResponse.success("Profile updated successfully", profile);
  }

  async getPublicByUsername(username: string) {
    const profile = await prisma.profile.findUnique({
      where: { username, isPublic: true },
      include: {
        links: {
          where: { isVisible: true },
          orderBy: { displayOrder: "asc" },
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!profile) {
      throw new AppError(
        "Profile not found or is private",
        StatusCodes.NOT_FOUND
      );
    }

    return ServiceResponse.success("Profile retrieved successfully", profile);
  }

  async checkUsernameAvailability(username: string) {
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
        isValid: true, // Already validated by schema
      }
    );
  }
}

export const profileService = new ProfileService();
