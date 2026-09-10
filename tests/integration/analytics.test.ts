import { describe, it, expect, vi, beforeEach } from "vitest";
import { testApp } from "../helpers/testApp";
import { authHeader, createTestUser } from "../helpers/factories";
import { prisma } from "@/lib/prisma";
import cache from "@/lib/cache";
import { utcDay } from "@/modules/analytics/analytics.utils";

vi.mock("@/lib/cache", () => ({
  default: {
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
  },
}));

const PUBLIC = "/api/v1/public";
const ANALYTICS = "/api/v1/analytics";

describe("Profile analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records a public profile view (counter + event + daily)", async () => {
    const user = await createTestUser();
    const username = user.profile!.username!;

    const res = await testApp.post(`${PUBLIC}/profiles/${username}/view`);
    expect(res.status).toBe(200);
    expect(res.body.data.recorded).toBe(true);

    const profile = await prisma.profile.findUnique({
      where: { id: user.profile!.id },
    });
    expect(profile?.viewCount).toBe(1);

    const events = await prisma.profileViewEvent.count({
      where: { profileId: user.profile!.id },
    });
    expect(events).toBe(1);

    const daily = await prisma.profileAnalyticsDaily.findUnique({
      where: {
        profileId_date: {
          profileId: user.profile!.id,
          date: utcDay(),
        },
      },
    });
    expect(daily?.views).toBe(1);
  });

  it("returns 404 for unknown / private profile views", async () => {
    const res = await testApp.post(`${PUBLIC}/profiles/no_such_user_xyz/view`);
    expect(res.status).toBe(404);
  });

  it("records link click events + daily when tracking clicks", async () => {
    const user = await createTestUser();
    const link = await prisma.link.create({
      data: {
        title: "Site",
        url: "https://example.com/analytics-click",
        displayOrder: 0,
        profileId: user.profile!.id,
        isVisible: true,
      },
    });

    const res = await testApp.post(`${PUBLIC}/links/${link.id}/click`);
    expect(res.status).toBe(200);

    const updated = await prisma.link.findUnique({ where: { id: link.id } });
    expect(updated?.clickCount).toBe(1);

    const clickEvents = await prisma.linkClickEvent.count({
      where: { linkId: link.id },
    });
    expect(clickEvents).toBe(1);

    const daily = await prisma.profileAnalyticsDaily.findUnique({
      where: {
        profileId_date: {
          profileId: user.profile!.id,
          date: utcDay(),
        },
      },
    });
    expect(daily?.linkClicks).toBe(1);
    expect(cache.del).toHaveBeenCalled();
  });

  it("rejects click on invisible link", async () => {
    const user = await createTestUser();
    const link = await prisma.link.create({
      data: {
        title: "Hidden",
        url: "https://example.com/hidden",
        displayOrder: 0,
        profileId: user.profile!.id,
        isVisible: false,
      },
    });

    const res = await testApp.post(`${PUBLIC}/links/${link.id}/click`);
    expect(res.status).toBe(404);
  });

  it("requires auth for owner analytics", async () => {
    const res = await testApp.get(`${ANALYTICS}/summary`);
    expect(res.status).toBe(401);
  });

  it("returns owner summary, daily, and top links", async () => {
    const user = await createTestUser();
    const headers = authHeader(user.id);
    const username = user.profile!.username!;

    const link = await prisma.link.create({
      data: {
        title: "Top Link",
        url: "https://example.com/top",
        displayOrder: 0,
        profileId: user.profile!.id,
        isVisible: true,
      },
    });

    await testApp.post(`${PUBLIC}/profiles/${username}/view`);
    await testApp.post(`${PUBLIC}/profiles/${username}/view`);
    await testApp.post(`${PUBLIC}/links/${link.id}/click`);

    const summary = await testApp
      .get(`${ANALYTICS}/summary`)
      .query({ range: "7d" })
      .set(headers);
    expect(summary.status).toBe(200);
    expect(summary.body.data.views).toBe(2);
    expect(summary.body.data.clicks).toBe(1);
    expect(summary.body.data.clickRate).toBe(0.5);
    expect(summary.body.data.range).toBe("7d");

    const daily = await testApp
      .get(`${ANALYTICS}/daily`)
      .query({ range: "7d" })
      .set(headers);
    expect(daily.status).toBe(200);
    expect(daily.body.data.days).toHaveLength(7);
    const today = daily.body.data.days[6];
    expect(today.views).toBe(2);
    expect(today.clicks).toBe(1);

    const links = await testApp
      .get(`${ANALYTICS}/links`)
      .query({ range: "30d" })
      .set(headers);
    expect(links.status).toBe(200);
    expect(links.body.data.links[0]).toMatchObject({
      linkId: link.id,
      title: "Top Link",
      clicks: 1,
    });
  });

  it("does not expose another user's analytics", async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    const username = owner.profile!.username!;

    await testApp.post(`${PUBLIC}/profiles/${username}/view`);

    const res = await testApp
      .get(`${ANALYTICS}/summary`)
      .query({ range: "30d" })
      .set(authHeader(other.id));

    expect(res.status).toBe(200);
    expect(res.body.data.views).toBe(0);
    expect(res.body.data.clicks).toBe(0);
  });
});
