import { beforeAll, beforeEach, afterAll } from "vitest";
import { execSync } from "child_process";
import { prisma } from "@/lib/prisma";

/**
 * Wipe app data between tests so each case starts clean.
 * Roles/permissions/themes are left alone as reference data.
 */
async function resetDatabase() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "links",
      "display_preferences",
      "profiles",
      "user_roles",
      "users",
      "waitlists"
    RESTART IDENTITY CASCADE;
  `);
}

beforeAll(() => {
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error(
      "TEST_DATABASE_URL is required. Add it to .env pointing at a dedicated test database (not your dev/prod DB)."
    );
  }

  // Keep the test schema in sync without interactive migrate prompts
  execSync("npx prisma db push --skip-generate", {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: process.env.TEST_DATABASE_URL,
    },
  });
});

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});
