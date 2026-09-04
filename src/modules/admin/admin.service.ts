import type { Prisma } from "@prisma/client";
import { StatusCodes } from "http-status-codes";
import { prisma } from "@/shared/config/database";
import {
  getPagination,
  getTotalPages,
} from "@/shared/utils/pagination";
import { ServiceResponse } from "@/shared/utils/serviceResponse";
import type { TListUsersQuery } from "./admin.schemas";

/** GET /api/v1/admin/me — small admin identity payload */
export const getMe = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: {
        include: { role: true },
      },
    },
  });

  if (!user) {
    return ServiceResponse.failure(
      "User not found",
      null,
      StatusCodes.NOT_FOUND
    );
  }

  return ServiceResponse.success("Admin profile retrieved successfully", {
    id: user.id,
    email: user.email,
    name: user.name,
    roles: user.roles.map(({ role }) => role.name),
  });
};

/**
 * GET /api/v1/admin/users
 *
 * Flow:
 * 1. Turn ?page=&limit= into skip/take (pagination)
 * 2. Build a Prisma `where` from optional filters (q, active, hasBadge)
 * 3. Run count + findMany in parallel
 * 4. Map DB rows → small admin-safe JSON (no password)
 */
export const listUsers = async (query: TListUsersQuery) => {
  // page/limit → skip (how many rows to jump over) + take (page size)
  const { page, limit, skip } = getPagination(query as Record<string, unknown>);

  // Start empty = "no filters" = all users
  const where: Prisma.UserWhereInput = {};

  // ?q=alice → name OR email contains "alice" (case-insensitive)
  if (query.q) {
    where.OR = [
      { name: { contains: query.q, mode: "insensitive" } },
      { email: { contains: query.q, mode: "insensitive" } },
    ];
  }

  // ?active=true|false → only active / inactive accounts
  // Query strings are always strings, so we compare to "true"
  if (query.active !== undefined) {
    where.active = query.active === "true";
  }

  // ?hasBadge=true  → user has at least one badge with revokedAt = null
  // ?hasBadge=false → user has no active (non-revoked) badge
  // "some" / "none" are Prisma relation filters on User.verificationBadges
  if (query.hasBadge === "true") {
    where.verificationBadges = { some: { revokedAt: null } };
  } else if (query.hasBadge === "false") {
    where.verificationBadges = { none: { revokedAt: null } };
  }

  // Promise.all = one round-trip wait for both queries
  const [total, users] = await Promise.all([
    prisma.user.count({ where }), // how many match (for totalPages)
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" }, // newest first
      // `select` = only these fields (never pull password)
      select: {
        id: true,
        email: true,
        name: true,
        active: true,
        isEmailVerified: true,
        createdAt: true,
        roles: {
          select: {
            role: { select: { name: true } },
          },
        },
        // Only load active badges for the hasBadge / badgeTypes fields
        verificationBadges: {
          where: { revokedAt: null },
          select: { badgeType: true },
        },
      },
    }),
  ]);

  // Shape the API response for the admin UI
  const data = {
    users: users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      active: user.active,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      roles: user.roles.map(({ role }) => role.name), // ["admin"] etc.
      hasBadge: user.verificationBadges.length > 0,
      badgeTypes: user.verificationBadges.map((b) => b.badgeType),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: getTotalPages(total, limit),
    },
  };

  return ServiceResponse.success("Users retrieved successfully", data);
};
