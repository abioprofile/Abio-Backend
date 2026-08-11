import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import env from "@/env";

type CreateTestUserInput = {
  email?: string;
  name?: string;
  password?: string;
  isEmailVerified?: boolean;
};

/**
 * Minimal user factory for integration tests.
 * Password is hashed by the Prisma user.create extension.
 */
export async function createTestUser(input: CreateTestUserInput = {}) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return prisma.user.create({
    data: {
      email: input.email ?? `user-${suffix}@test.abio.local`,
      name: input.name ?? "Test User",
      password: input.password ?? "Password123!",
      isEmailVerified: input.isEmailVerified ?? true,
      profile: {
        create: {
          username: `user_${suffix}`,
        },
      },
    },
    include: {
      profile: true,
    },
  });
}

/** JWT matching how auth middleware verifies tokens (`{ id }`). */
export function signTestToken(userId: string) {
  return jwt.sign({ id: userId }, env.JWT_SECRET, {
    expiresIn: "1d",
  });
}

export function authHeader(userId: string) {
  return { Authorization: `Bearer ${signTestToken(userId)}` };
}
