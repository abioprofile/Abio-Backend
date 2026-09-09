import { Prisma } from "@prisma/client";
import { StatusCodes } from "http-status-codes";
import { prisma } from "@/shared/config/database";
import {
    getPagination,
    getTotalPages,
} from "@/shared/utils/pagination";
import { ServiceResponse } from "@/shared/utils/serviceResponse";
import type {
  TListUsersQuery,
  TUpdateUserBody,
  TAssignBadgeBody,
  TRevokeBadgeBody,
  TCreateInviteBody,
  TAcceptInviteBody,
} from "./admin.schemas";
import { createRawToken, hashRawToken } from "@/modules/auth/auth.tokens";
import env from "@/env";

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
                isOnboardingCompleted: true,
                updatedAt: true,
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
            isOnboardingCompleted: user.isOnboardingCompleted,
            updatedAt: user.updatedAt,
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

/** GET /api/v1/admin/users/:id — full user detail for staff */
export const getUserById = async (id: string) => {
    const user = await prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            email: true,
            name: true,
            active: true,
            isEmailVerified: true,
            createdAt: true,
            roles: { select: { role: { select: { name: true } } } },
            profile: {
                select: {
                    username: true,
                    avatarUrl: true,
                    bio: true,
                    isPublic: true,
                    location: true,
                },
            },
            verificationBadges: {
                orderBy: { assignedAt: "desc" },
                select: {
                    id: true,
                    badgeType: true,
                    assignedAt: true,
                    revokedAt: true,
                    revokeReason: true,
                },
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

    const activeBadges = user.verificationBadges.filter(
        (b) => b.revokedAt === null
    );

    return ServiceResponse.success("User details retrieved successfully", {
        id: user.id,
        email: user.email,
        name: user.name,
        active: user.active,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
        roles: user.roles.map(({ role }) => role.name),
        profile: user.profile,
        hasBadge: activeBadges.length > 0,
        badges: user.verificationBadges,
    });
};

/** PATCH /api/v1/admin/users/:id — deactivate / reactivate */
export const updateUser = async (
  targetId: string,
  body: TUpdateUserBody,
  actorId: string
) => {
  const user = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, active: true },
  });

  if (!user) {
    return ServiceResponse.failure(
      "User not found",
      null,
      StatusCodes.NOT_FOUND
    );
  }

  if (targetId === actorId) {
    return ServiceResponse.failure(
      "Cannot update your own account",
      null,
      StatusCodes.FORBIDDEN
    );
  }

  const updatedUser = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: targetId },
      data: { active: body.active },
      select: {
        id: true,
        email: true,
        name: true,
        active: true,
        isEmailVerified: true,
        createdAt: true,
      },
    });

    await tx.adminAuditLog.create({
      data: {
        adminId: actorId,
        action: body.active ? "user.reactivate" : "user.deactivate",
        resourceType: "user",
        resourceId: targetId,
        oldValue: { active: user.active },
        newValue: { active: body.active },
      },
    });

    return updated;
  });

  return ServiceResponse.success(
    `User ${body.active ? "reactivated" : "deactivated"} successfully`,
    updatedUser
  );
};

const badgeSelect = {
  id: true,
  badgeType: true,
  assignedAt: true,
  assignedById: true,
  revokedAt: true,
  revokedById: true,
  revokeReason: true,
} as const;

/** POST /api/v1/admin/users/:id/badges — assign or re-grant a verification badge */
export const assignBadge = async (
  userId: string,
  body: TAssignBadgeBody,
  actorId: string
) => {
  const badgeType = body.badgeType ?? "verified";

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    return ServiceResponse.failure(
      "User not found",
      null,
      StatusCodes.NOT_FOUND
    );
  }

  const existing = await prisma.verificationBadge.findUnique({
    where: {
      userId_badgeType: { userId, badgeType },
    },
    select: badgeSelect,
  });

  const badge = await prisma.$transaction(async (tx) => {
    const upserted = await tx.verificationBadge.upsert({
      where: {
        userId_badgeType: { userId, badgeType },
      },
      create: {
        userId,
        badgeType,
        assignedById: actorId,
      },
      update: {
        revokedAt: null,
        revokedById: null,
        revokeReason: null,
        assignedById: actorId,
        assignedAt: new Date(),
      },
      select: badgeSelect,
    });

    // Keep request queue consistent with direct grants
    await tx.badgeRequest.updateMany({
      where: { userId, badgeType, status: "pending" },
      data: {
        status: "approved",
        reviewedAt: new Date(),
        reviewedById: actorId,
        reviewNote: "Closed by admin direct grant",
      },
    });

    await tx.adminAuditLog.create({
      data: {
        adminId: actorId,
        action: "badge.assign",
        resourceType: "verification_badge",
        resourceId: upserted.id,
        oldValue: existing
          ? {
              badgeType: existing.badgeType,
              revokedAt: existing.revokedAt,
            }
          : Prisma.JsonNull,
        newValue: {
          userId,
          badgeType: upserted.badgeType,
          assignedAt: upserted.assignedAt,
          revokedAt: upserted.revokedAt,
        },
      },
    });

    return upserted;
  });

  return ServiceResponse.success(
    "Badge assigned successfully",
    badge,
    existing ? StatusCodes.OK : StatusCodes.CREATED
  );
};

/** POST /api/v1/admin/users/:id/badges/:badgeType/revoke */
export const revokeBadge = async (
  userId: string,
  badgeType: string,
  body: TRevokeBadgeBody,
  actorId: string
) => {
  const badge = await prisma.verificationBadge.findFirst({
    where: {
      userId,
      badgeType,
      revokedAt: null,
    },
    select: badgeSelect,
  });

  if (!badge) {
    return ServiceResponse.failure(
      "Active badge not found",
      null,
      StatusCodes.NOT_FOUND
    );
  }

  const revoked = await prisma.$transaction(async (tx) => {
    const updated = await tx.verificationBadge.update({
      where: { id: badge.id },
      data: {
        revokedAt: new Date(),
        revokedById: actorId,
        revokeReason: body.reason ?? null,
      },
      select: badgeSelect,
    });

    await tx.adminAuditLog.create({
      data: {
        adminId: actorId,
        action: "badge.revoke",
        resourceType: "verification_badge",
        resourceId: updated.id,
        oldValue: {
          badgeType: badge.badgeType,
          revokedAt: null,
        },
        newValue: {
          badgeType: updated.badgeType,
          revokedAt: updated.revokedAt,
          revokeReason: updated.revokeReason,
        },
      },
    });

    return updated;
  });

  return ServiceResponse.success("Badge revoked successfully", revoked);
};

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** POST /api/v1/admin/invites — admin invites a moderator by email */
export const createInvite = async (
  body: TCreateInviteBody,
  actorId: string
) => {
  const email = body.email.toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      roles: { select: { role: { select: { name: true } } } },
    },
  });

  if (existingUser) {
    const roleNames = existingUser.roles.map(({ role }) => role.name);
    if (roleNames.includes("admin") || roleNames.includes("moderator")) {
      return ServiceResponse.failure(
        "User already has a staff role",
        null,
        StatusCodes.CONFLICT
      );
    }
  }

  const { raw, hash } = createRawToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  const invite = await prisma.$transaction(async (tx) => {
    // Drop older unused invites for this email so only one pending token matters
    await tx.adminInvite.deleteMany({
      where: {
        email,
        acceptedAt: null,
      },
    });

    const created = await tx.adminInvite.create({
      data: {
        email,
        role: "moderator",
        tokenHash: hash,
        invitedById: actorId,
        expiresAt,
      },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    await tx.adminAuditLog.create({
      data: {
        adminId: actorId,
        action: "invite.create",
        resourceType: "admin_invite",
        resourceId: created.id,
        newValue: {
          email: created.email,
          role: created.role,
          expiresAt: created.expiresAt,
        },
      },
    });

    return created;
  });

  // Raw token returned once — store hash only. Email wiring can come later.
  return ServiceResponse.success(
    "Moderator invite created successfully",
    {
      ...invite,
      token: raw,
      inviteUrl: `${env.CLIENT_URL}/admin/accept-invite?token=${raw}`,
    },
    StatusCodes.CREATED
  );
};

/** POST /api/v1/admin/invites/accept — logged-in user accepts moderator invite */
export const acceptInvite = async (
  body: TAcceptInviteBody,
  actorId: string,
  actorEmail: string
) => {
  const tokenHash = hashRawToken(body.token);

  const invite = await prisma.adminInvite.findUnique({
    where: { tokenHash },
  });

  if (!invite) {
    return ServiceResponse.failure(
      "Invalid invite token",
      null,
      StatusCodes.NOT_FOUND
    );
  }

  if (invite.acceptedAt) {
    return ServiceResponse.failure(
      "Invite already accepted",
      null,
      StatusCodes.CONFLICT
    );
  }

  if (invite.expiresAt.getTime() < Date.now()) {
    return ServiceResponse.failure(
      "Invite has expired",
      null,
      StatusCodes.GONE
    );
  }

  if (invite.email.toLowerCase() !== actorEmail.toLowerCase()) {
    return ServiceResponse.failure(
      "Invite email does not match your account",
      null,
      StatusCodes.FORBIDDEN
    );
  }

  const role = await prisma.role.upsert({
    where: { name: "moderator" },
    create: { name: "moderator" },
    update: {},
  });

  await prisma.$transaction(async (tx) => {
    await tx.userRole.upsert({
      where: {
        userId_roleId: { userId: actorId, roleId: role.id },
      },
      create: { userId: actorId, roleId: role.id },
      update: {},
    });

    await tx.adminInvite.update({
      where: { id: invite.id },
      data: {
        acceptedAt: new Date(),
        acceptedUserId: actorId,
      },
    });

    await tx.adminAuditLog.create({
      data: {
        adminId: actorId,
        action: "invite.accept",
        resourceType: "admin_invite",
        resourceId: invite.id,
        newValue: {
          email: invite.email,
          role: invite.role,
          acceptedUserId: actorId,
        },
      },
    });
  });

  return ServiceResponse.success("Invite accepted successfully", {
    role: invite.role,
    email: invite.email,
  });
};
