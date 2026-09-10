import { StatusCodes } from "http-status-codes";
import { prisma } from "@/shared/config/database";
import { ServiceResponse } from "@/shared/utils/serviceResponse";
import { utcDay } from "@/modules/analytics/analytics.utils";

/** POST /api/v1/public/profiles/:username/view */
export const trackProfileView = async (username: string) => {
  const profile = await prisma.profile.findFirst({
    where: {
      username: { equals: username, mode: "insensitive" },
      isPublic: true,
    },
    select: { id: true },
  });

  if (!profile) {
    return ServiceResponse.failure(
      "Profile not found",
      null,
      StatusCodes.NOT_FOUND
    );
  }

  const day = utcDay();

  await prisma.$transaction(async (tx) => {
    await tx.profileViewEvent.create({
      data: { profileId: profile.id },
    });

    await tx.profile.update({
      where: { id: profile.id },
      data: { viewCount: { increment: 1 } },
    });

    await tx.profileAnalyticsDaily.upsert({
      where: {
        profileId_date: { profileId: profile.id, date: day },
      },
      create: {
        profileId: profile.id,
        date: day,
        views: 1,
        linkClicks: 0,
      },
      update: { views: { increment: 1 } },
    });
  });

  return ServiceResponse.success("View recorded", { recorded: true });
};
