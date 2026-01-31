import { prisma } from "@/server";
import { TUpdateProfile } from "@/schemas/profile.schema";
import { ServiceResponse } from "@/utils/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { AppError } from "@/utils/appError";
import { uploadToCloudinary } from "@/utils/cloudinary";

export class ProfileService {
  async getByUserId(userId: string) {
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
        StatusCodes.NOT_FOUND,
      );
    }
    return ServiceResponse.success("Profile retrieved successfully", profile);
  }

  async update(
    userId: string,
    data: TUpdateProfile & { displayName?: string },
  ) {
    // Check if username is being updated and if it's already taken
    if (data.username) {
      const existingProfile = await prisma.profile.findUnique({
        where: { username: data.username },
      });

      if (existingProfile && existingProfile.userId !== userId) {
        throw new AppError("Username is already taken", StatusCodes.CONFLICT);
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
          select: {name: true},
        }
      },
    });


    if (
      profile?.username &&
      profile.goals.length > 0
      // && profile.displayName
    ) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          isOnboardingCompleted: true,
        },
      });
    }

    return ServiceResponse.success("Profile updated successfully", profile);
  }

  async getPublicByUsername(username: string) {
    const profile = await prisma.profile.findUnique({
      where: { username, isPublic: true },
      select: {
        id: true,
        userId: true,
        username: true,
        // displayName: true,
        bio: true,
        location: true,
        avatarUrl: true,
        isPublic: true,
        createdAt: true,
        updatedAt: true,
        // Exclude goals and user details from public profile
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
        StatusCodes.NOT_FOUND,
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
      },
    );
  }

  async updateAvatar(userId: string, fileBuffer: Buffer) {
    const { url } = await uploadToCloudinary(fileBuffer, "avatars");

    const profile = await prisma.profile.update({
      where: { userId },
      data: { avatarUrl: url },
      include: {
        links: {
          orderBy: { displayOrder: "asc" },
        },
      },
    });

    return ServiceResponse.success("Avatar updated successfully", profile);
  }
}

export const profileService = new ProfileService();
