import { beforeAll, beforeEach, afterAll, vi } from "vitest";
import { execSync } from "child_process";
import { prisma } from "@/lib/prisma";

/** Avoid hitting Redis/SMTP from integration tests — services enqueue only. */
vi.mock("@/queues/queue", () => ({
  emailQueue: {
    add: vi.fn().mockResolvedValue({ id: "test-job" }),
    process: vi.fn(),
    on: vi.fn(),
  },
  enqueueVerificationEmail: vi.fn().mockResolvedValue({ id: "test-job" }),
  enqueuePasswordResetEmail: vi.fn().mockResolvedValue({ id: "test-job" }),
  enqueueWelcomeEmail: vi.fn().mockResolvedValue({ id: "test-job" }),
  enqueueWaitlistConfirmationEmail: vi
    .fn()
    .mockResolvedValue({ id: "test-job" }),
}));

/**
 * Wipe app data between tests so each case starts clean.
 * Roles/permissions/themes are left alone as reference data.
 */
async function resetDatabase() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "refresh_tokens",
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

  // Keep the test schema in sync without interactive migrate prompts.
  // Retry: concurrent vitest workers can contend on Prisma's advisory lock.
  const env = {
    ...process.env,
    DATABASE_URL: process.env.TEST_DATABASE_URL,
  };
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      execSync("npx prisma db push --skip-generate", {
        stdio: "pipe",
        env,
      });
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      const message = [
        (error as { stdout?: Buffer }).stdout?.toString("utf8"),
        (error as { stderr?: Buffer }).stderr?.toString("utf8"),
      ]
        .filter(Boolean)
        .join("\n");

      // Treat "already synced" as success even if the process exit code was odd.
      if (/already in sync|now in sync/i.test(message)) {
        lastError = undefined;
        break;
      }

      if (attempt < 3) {
        execSync(`sleep ${attempt}`);
      }
    }
  }

  if (lastError) {
    throw lastError;
  }
});

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});
