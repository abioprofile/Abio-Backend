-- CreateTable
CREATE TABLE "display_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "selected_theme" TEXT,
    "font_config" JSONB DEFAULT '{}',
    "corner_config" JSONB DEFAULT '{}',
    "wallpaper_config" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "display_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "display_preferences_profileId_key" ON "display_preferences"("profileId");

-- AddForeignKey
ALTER TABLE "display_preferences" ADD CONSTRAINT "display_preferences_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "display_preferences" ADD CONSTRAINT "display_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
