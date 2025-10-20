import { prisma } from "@/server";
import { ServiceResponse } from "@/utils/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { AppError } from "@/utils/appError";
import { SOCIAL_PLATFORMS } from "@/utils/constants";
import type {
  TCreateLink,
  TUpdateLink,
  TReorderLinks,
} from "@/schemas/link.schema";

export class LinkService {
  /**
   * Detect social media platform from URL
   */
  private detectPlatform(url: string): string | null {
    for (const [key, platform] of Object.entries(SOCIAL_PLATFORMS)) {
      if (platform.urlPattern.test(url)) {
        return key.toUpperCase();
      }
    }
    return null;
  }

  async create(userId: string, data: TCreateLink) {
    const profile = await prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new AppError("Profile not found", StatusCodes.NOT_FOUND);
    }

    // Get current max order
    const maxOrder = await prisma.link.findFirst({
      where: { profileId: profile.id },
      orderBy: { displayOrder: "desc" },
      select: { displayOrder: true },
    });

    // Detect platform from URL or use provided platform
    const detectedPlatform = this.detectPlatform(data.url);
    const platform = detectedPlatform || data.platform || null;

    const link = await prisma.link.create({
      data: {
        title: data.title,
        url: data.url,
        platform,
        isVisible: data.isVisible ?? true,
        profileId: profile.id,
        displayOrder: (maxOrder?.displayOrder ?? -1) + 1,
      },
    });

    return ServiceResponse.success(
      "Link created successfully",
      link,
      StatusCodes.CREATED
    );
  }

  async getAllByUserId(userId: string) {
    const profile = await prisma.profile.findUnique({
      where: { userId },
      include: {
        links: {
          orderBy: { displayOrder: "asc" },
        },
      },
    });

    if (!profile) {
      throw new AppError("Profile not found", StatusCodes.NOT_FOUND);
    }

    return ServiceResponse.success(
      "Links retrieved successfully",
      profile.links
    );
  }

  async getById(linkId: string, userId: string) {
    const link = await prisma.link.findFirst({
      where: {
        id: linkId,
        profile: { userId },
      },
    });

    if (!link) {
      throw new AppError(
        "Link not found or you don't have permission",
        StatusCodes.NOT_FOUND
      );
    }

    return ServiceResponse.success("Link retrieved successfully", link);
  }

  async update(linkId: string, userId: string, data: TUpdateLink) {
    // Verify ownership
    const link = await prisma.link.findFirst({
      where: {
        id: linkId,
        profile: { userId },
      },
    });

    if (!link) {
      throw new AppError(
        "Link not found or you don't have permission",
        StatusCodes.NOT_FOUND
      );
    }

    // Re-detect platform if URL is being updated, or use provided platform
    const updateData: any = { ...data };
    if (data.url) {
      const detectedPlatform = this.detectPlatform(data.url);
      updateData.platform = detectedPlatform || data.platform || null;
    } else if (data.platform) {
      updateData.platform = data.platform;
    }

    const updatedLink = await prisma.link.update({
      where: { id: linkId },
      data: updateData,
    });

    return ServiceResponse.success("Link updated successfully", updatedLink);
  }

  async delete(linkId: string, userId: string) {
    const link = await prisma.link.findFirst({
      where: {
        id: linkId,
        profile: { userId },
      },
    });

    if (!link) {
      throw new AppError(
        "Link not found or you don't have permission",
        StatusCodes.NOT_FOUND
      );
    }

    await prisma.link.delete({
      where: { id: linkId },
    });

    return ServiceResponse.success("Link deleted successfully", null);
  }

  async reorder(userId: string, data: TReorderLinks) {
    const profile = await prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new AppError("Profile not found", StatusCodes.NOT_FOUND);
    }

    // Verify all links belong to this user's profile
    const linkIds = data.links.map((l) => l.id);
    const existingLinks = await prisma.link.findMany({
      where: {
        id: { in: linkIds },
        profileId: profile.id,
      },
      select: { id: true },
    });

    if (existingLinks.length !== linkIds.length) {
      throw new AppError(
        "One or more links not found or don't belong to you",
        StatusCodes.BAD_REQUEST
      );
    }

    // Update all in transaction
    await prisma.$transaction(
      data.links.map(({ id, displayOrder }) =>
        prisma.link.update({
          where: { id },
          data: { displayOrder },
        })
      )
    );

    return ServiceResponse.success("Links reordered successfully", null);
  }

  async trackClick(linkId: string) {
    const link = await prisma.link.findUnique({
      where: { id: linkId },
    });

    if (!link) {
      throw new AppError("Link not found", StatusCodes.NOT_FOUND);
    }

    await prisma.link.update({
      where: { id: linkId },
      data: {
        clickCount: { increment: 1 },
      },
    });

    return ServiceResponse.success("Click tracked", null);
  }
}

export const linkService = new LinkService();
