import { StatusCodes } from "http-status-codes";
import { prisma } from "@/shared/config/database";
import { ServiceResponse } from "@/shared/utils/serviceResponse";
import {
  clickRate,
  rangeWindow,
  type AnalyticsRange,
  utcDay,
} from "./analytics.utils";
import type { TAnalyticsRangeQuery } from "./analytics.schemas";

const getOwnerProfile = async (userId: string) => {
  return prisma.profile.findUnique({
    where: { userId },
    select: { id: true, username: true },
  });
};

const formatDateKey = (d: Date) => d.toISOString().slice(0, 10);

/** GET /api/v1/analytics/summary */
export const getSummary = async (
  userId: string,
  query: TAnalyticsRangeQuery
) => {
  const profile = await getOwnerProfile(userId);
  if (!profile) {
    return ServiceResponse.failure(
      "Profile not found",
      null,
      StatusCodes.NOT_FOUND
    );
  }

  const range = (query.range ?? "30d") as AnalyticsRange;
  const { from, to } = rangeWindow(range);
  // include full end day
  const toExclusive = new Date(to);
  toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);

  const [views, clicks] = await Promise.all([
    prisma.profileViewEvent.count({
      where: {
        profileId: profile.id,
        viewedAt: { gte: from, lt: toExclusive },
      },
    }),
    prisma.linkClickEvent.count({
      where: {
        profileId: profile.id,
        clickedAt: { gte: from, lt: toExclusive },
      },
    }),
  ]);

  return ServiceResponse.success("Analytics summary retrieved", {
    range,
    from: formatDateKey(from),
    to: formatDateKey(to),
    views,
    clicks,
    clickRate: clickRate(views, clicks),
  });
};

/** GET /api/v1/analytics/daily */
export const getDaily = async (
  userId: string,
  query: TAnalyticsRangeQuery
) => {
  const profile = await getOwnerProfile(userId);
  if (!profile) {
    return ServiceResponse.failure(
      "Profile not found",
      null,
      StatusCodes.NOT_FOUND
    );
  }

  const range = (query.range ?? "30d") as AnalyticsRange;
  const { from, to, days } = rangeWindow(range);

  const rows = await prisma.profileAnalyticsDaily.findMany({
    where: {
      profileId: profile.id,
      date: { gte: from, lte: to },
    },
    orderBy: { date: "asc" },
  });

  const byDate = new Map(
    rows.map((r) => [formatDateKey(utcDay(r.date)), r])
  );

  const series: Array<{ date: string; views: number; clicks: number }> = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(from);
    d.setUTCDate(from.getUTCDate() + i);
    const key = formatDateKey(d);
    const row = byDate.get(key);
    series.push({
      date: key,
      views: row?.views ?? 0,
      clicks: row?.linkClicks ?? 0,
    });
  }

  return ServiceResponse.success("Daily analytics retrieved", {
    range,
    from: formatDateKey(from),
    to: formatDateKey(to),
    days: series,
  });
};

/** GET /api/v1/analytics/links */
export const getTopLinks = async (
  userId: string,
  query: TAnalyticsRangeQuery
) => {
  const profile = await getOwnerProfile(userId);
  if (!profile) {
    return ServiceResponse.failure(
      "Profile not found",
      null,
      StatusCodes.NOT_FOUND
    );
  }

  const range = (query.range ?? "30d") as AnalyticsRange;
  const { from, to } = rangeWindow(range);
  const toExclusive = new Date(to);
  toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);

  const grouped = await prisma.linkClickEvent.groupBy({
    by: ["linkId"],
    where: {
      profileId: profile.id,
      clickedAt: { gte: from, lt: toExclusive },
    },
    _count: { _all: true },
    orderBy: { _count: { linkId: "desc" } },
    take: 20,
  });

  const linkIds = grouped.map((g) => g.linkId);
  const links = await prisma.link.findMany({
    where: { id: { in: linkIds } },
    select: { id: true, title: true, url: true },
  });
  const linkMap = new Map(links.map((l) => [l.id, l]));

  const topLinks = grouped.map((g) => {
    const link = linkMap.get(g.linkId);
    return {
      linkId: g.linkId,
      title: link?.title ?? "Deleted link",
      url: link?.url ?? null,
      clicks: g._count._all,
    };
  });

  return ServiceResponse.success("Link analytics retrieved", {
    range,
    from: formatDateKey(from),
    to: formatDateKey(to),
    links: topLinks,
  });
};
