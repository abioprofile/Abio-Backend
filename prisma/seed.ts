import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * Role names used by the app:
 * - "admin"     → full admin (themes, invites, refunds, etc.) — same as hasRole("admin")
 * - "moderator" → invited staff (AdminInviteRole.moderator)
 *
 * We do NOT use "super_admin". That was only PRD wording.
 */
const ROLES = ["admin", "moderator"] as const;

const prisma = new PrismaClient();

async function seedRoles() {
  for (const name of ROLES) {
    await prisma.role.upsert({
      where: { name },
      create: { name },
      update: {},
    });
    console.log(`✓ role: ${name}`);
  }
}

/**
 * Optional first admin account.
 * Set in .env (local only — never commit real passwords):
 *   ADMIN_SEED_EMAIL=you@example.com
 *   ADMIN_SEED_PASSWORD=a-strong-password
 *   ADMIN_SEED_NAME=Abio Admin
 */
async function seedAdminUser() {
  const email = process.env.ADMIN_SEED_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD;
  const name = process.env.ADMIN_SEED_NAME?.trim() || "Abio Admin";

  if (!email || !password) {
    console.log(
      "⏭  Skipping admin user seed (set ADMIN_SEED_EMAIL + ADMIN_SEED_PASSWORD to create one)"
    );
    return;
  }

  if (password.length < 8) {
    throw new Error("ADMIN_SEED_PASSWORD must be at least 8 characters");
  }

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { name: "admin" },
  });

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      password: passwordHash,
      isEmailVerified: true,
      isOnboardingCompleted: true,
      active: true,
      profile: {
        create: {},
      },
    },
    update: {
      // Keep existing password unless you intentionally rotate via env later
      active: true,
      isEmailVerified: true,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: adminRole.id,
      },
    },
    create: {
      userId: user.id,
      roleId: adminRole.id,
    },
    update: {},
  });

  console.log(`✓ admin user: ${email} (role: admin)`);
}

async function main() {
  await seedRoles();
  await seedAdminUser();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
