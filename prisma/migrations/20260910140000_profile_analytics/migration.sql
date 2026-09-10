-- AlterTable
ALTER TABLE "profiles" ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "profile_view_events" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "viewedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_view_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "link_click_events" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "clickedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "link_click_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_analytics_daily" (
    "profileId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "linkClicks" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "profile_analytics_daily_pkey" PRIMARY KEY ("profileId","date")
);

-- CreateIndex
CREATE INDEX "profile_view_events_profileId_viewedAt_idx" ON "profile_view_events"("profileId", "viewedAt");

-- CreateIndex
CREATE INDEX "link_click_events_linkId_clickedAt_idx" ON "link_click_events"("linkId", "clickedAt");

-- CreateIndex
CREATE INDEX "link_click_events_profileId_clickedAt_idx" ON "link_click_events"("profileId", "clickedAt");

-- AddForeignKey
ALTER TABLE "profile_view_events" ADD CONSTRAINT "profile_view_events_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "link_click_events" ADD CONSTRAINT "link_click_events_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "link_click_events" ADD CONSTRAINT "link_click_events_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_analytics_daily" ADD CONSTRAINT "profile_analytics_daily_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
