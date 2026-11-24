import crypto from "crypto";
import QRCode from "qrcode";
import { Prisma } from "@prisma/client";
import { StatusCodes } from "http-status-codes";

import { prisma } from "@/shared/config/database";
import logger from "@/shared/config/logger";
import { AppError } from "@/shared/utils/appError";
import { ConflictError, NotFoundError } from "@/shared/utils/errors";
import { ServiceResponse } from "@/shared/utils/serviceResponse";
import { getPagination, getTotalPages } from "@/shared/utils/pagination";
import { bustPublicProfileCache } from "@/modules/profiles/profile.service";
import { sendGiftAccountClaim } from "@/shared/utils/email";
import { enqueueVerificationEmail } from "@/queues/queue";
import { hashPassword } from "@/modules/users/user.service";
import {
  buildEmailVerificationUrl,
  buildPasswordResetUrl,
  createRawToken,
  hashRawToken,
  revokeAllRefreshTokensForUser,
} from "@/modules/auth/auth.tokens";
import type {
  TCreateGiftAccount,
  TIssueClaimLink,
  TListGiftAccountsQuery,
} from "./gift-accounts.schemas";

/** Claim links ship with physical cards, so they stay valid for 30 days. */
export const CLAIM_LINK_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Claim link = the main site's existing reset-password page, so no public
 * site changes are needed. The same URL is emailed and encoded in the QR code.
 */
export const buildClaimUrl = (rawToken: string) =>
  buildPasswordResetUrl(rawToken);

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002";

const assertEmailAvailable = async (email: string, exceptUserId?: string) => {
  const existing = await prisma.user.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      ...(exceptUserId ? { id: { not: exceptUserId } } : {}),
    },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError("A user with this email already exists.");
  }
};

const assertUsernameAvailable = async (username: string) => {
  const existing = await prisma.profile.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError("Username is already taken");
  }
};

type ClaimLinkDelivery = {
  claimUrl: string;
  qrCodeDataUrl: string;
  expiresAt: Date;
  emailStatus: "sent" | "failed" | "skipped";
  emailError?: string;
};

/**
 * Build the one-time link + QR code for staff and optionally email it.
 * The raw token only lives in this response; the DB keeps its hash.
 */
const deliverClaimLink = async (
  rawToken: string,
  expiresAt: Date,
  recipient: { email: string; name: string },
  sendEmail: boolean
): Promise<ClaimLinkDelivery> => {
  const claimUrl = buildClaimUrl(rawToken);
  const qrCodeDataUrl = await QRCode.toDataURL(claimUrl, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 512,
  });

  let emailStatus: ClaimLinkDelivery["emailStatus"] = "skipped";
  let emailError: string | undefined;

  if (sendEmail) {
    try {
      await sendGiftAccountClaim({
        to: recipient.email,
        name: recipient.name,
        claimUrl,
        expiresAt,
      });
      emailStatus = "sent";
    } catch (error) {
      emailStatus = "failed";
      const code = (error as { code?: string }).code;
      emailError =
        code === "EAUTH"
          ? "The email provider rejected the SMTP credentials. Share the QR code or link instead."
          : "The email could not be sent. Share the QR code or link instead.";
      // Never log the raw token or URL.
      logger.error({ code }, "Failed to send gift account claim email");
    }
  }

  return { claimUrl, qrCodeDataUrl, expiresAt, emailStatus, emailError };
};

const giftAccountSummarySelect = {
  id: true,
  claimedAt: true,
  claimTokenExpiresAt: true,
  createdAt: true,
  createdBy: { select: { id: true, name: true } },
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      active: true,
      isEmailVerified: true,
      profile: {
        select: { username: true, avatarUrl: true, isPublic: true },
      },
    },
  },
} satisfies Prisma.GiftAccountSelect;

type GiftAccountSummaryRow = Prisma.GiftAccountGetPayload<{
  select: typeof giftAccountSummarySelect;
}>;

const shapeSummary = (row: GiftAccountSummaryRow) => ({
  userId: row.user.id,
  name: row.user.name,
  email: row.user.email,
  username: row.user.profile?.username ?? null,
  avatarUrl: row.user.profile?.avatarUrl ?? null,
  isPublic: row.user.profile?.isPublic ?? true,
  active: row.user.active,
  isEmailVerified: row.user.isEmailVerified,
  status: row.claimedAt ? ("claimed" as const) : ("unclaimed" as const),
  claimedAt: row.claimedAt,
  // Only meaningful while unclaimed; never exposes the token itself.
  claimLinkExpiresAt: row.claimedAt ? null : row.claimTokenExpiresAt,
  createdAt: row.createdAt,
  createdBy: row.createdBy,
});

/** Admin audit trail for every gift-account action. Never stores tokens. */
export const recordGiftAudit = async (
  actorId: string,
  userId: string,
  action: string,
  metadata?: Prisma.InputJsonValue,
  db: { adminAuditLog: Pick<typeof prisma.adminAuditLog, "create"> } = prisma
) => {
  await db.adminAuditLog.create({
    data: {
      adminId: actorId,
      action: `gift_account.${action}`,
      resourceType: "user",
      resourceId: userId,
      metadata,
    },
  });
};

/** POST /api/v1/admin/gift-accounts */
export const createGiftAccount = async (
  body: TCreateGiftAccount,
  actorId: string
) => {
  await assertEmailAvailable(body.email);
  await assertUsernameAvailable(body.username);

  const { raw, hash } = createRawToken(32);
  const expiresAt = new Date(Date.now() + CLAIM_LINK_TTL_MS);
  const email = body.email;

  let created: GiftAccountSummaryRow;
  try {
    created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name: body.name,
          // Random secret nobody (staff included) ever sees; hashed by the
          // Prisma user.create extension. Replaced when the recipient claims.
          password: crypto.randomBytes(32).toString("hex"),
          isEmailVerified: false,
          // Staff build the profile, so the recipient skips onboarding.
          isOnboardingCompleted: true,
          // No tap emails until the recipient owns the account.
          notifyOnLinkTap: false,
          profile: { create: { username: body.username } },
          giftAccount: {
            create: {
              createdById: actorId,
              claimTokenHash: hash,
              claimTokenExpiresAt: expiresAt,
            },
          },
        },
        select: { id: true },
      });

      await recordGiftAudit(
        actorId,
        user.id,
        "create",
        { name: body.name, username: body.username, sendEmail: body.sendEmail },
        tx
      );

      return tx.giftAccount.findUniqueOrThrow({
        where: { userId: user.id },
        select: giftAccountSummarySelect,
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("A user with this email or username already exists.");
    }
    throw error;
  }

  const claim = await deliverClaimLink(
    raw,
    expiresAt,
    { email, name: body.name },
    body.sendEmail
  );

  return ServiceResponse.success(
    "Gift account created successfully",
    { account: shapeSummary(created), claim },
    StatusCodes.CREATED
  );
};

/** GET /api/v1/admin/gift-accounts */
export const listGiftAccounts = async (query: TListGiftAccountsQuery) => {
  const { page, limit, skip } = getPagination(query as Record<string, unknown>);

  const where: Prisma.GiftAccountWhereInput = {};
  if (query.status === "claimed") where.claimedAt = { not: null };
  if (query.status === "unclaimed") where.claimedAt = null;
  if (query.q) {
    where.user = {
      OR: [
        { name: { contains: query.q, mode: "insensitive" } },
        { email: { contains: query.q, mode: "insensitive" } },
        { profile: { username: { contains: query.q, mode: "insensitive" } } },
      ],
    };
  }

  const [total, rows] = await Promise.all([
    prisma.giftAccount.count({ where }),
    prisma.giftAccount.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: giftAccountSummarySelect,
    }),
  ]);

  return ServiceResponse.success("Gift accounts retrieved successfully", {
    accounts: rows.map(shapeSummary),
    pagination: {
      page,
      limit,
      total,
      totalPages: getTotalPages(total, limit),
    },
  });
};

/** GET /api/v1/admin/gift-accounts/:userId — summary + full profile */
export const getGiftAccount = async (userId: string) => {
  const row = await prisma.giftAccount.findUnique({
    where: { userId },
    select: giftAccountSummarySelect,
  });
  if (!row) throw new NotFoundError("Gift account");

  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: {
      id: true,
      username: true,
      bio: true,
      location: true,
      avatarUrl: true,
      goals: true,
      isPublic: true,
      createdAt: true,
      updatedAt: true,
      links: { orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }] },
      display: true,
    },
  });

  return ServiceResponse.success("Gift account retrieved successfully", {
    ...shapeSummary(row),
    profile,
  });
};

/**
 * A claim can't complete while a staff edit may still be running. Each edit
 * stamps `staffEditStartedAt`; claims wait until it is older than this.
 */
export const STAFF_EDIT_WINDOW_MS = 60 * 1000;

/**
 * Staff may only edit gift accounts that are still unclaimed.
 * Atomically stamps the edit start so it can't interleave with a claim:
 * either this update lands first (and the claim waits), or the claim lands
 * first (and this update matches no row → 409).
 * Throws 404 for non-gift users so this can't be used on regular accounts.
 */
export const beginStaffEdit = async (userId: string) => {
  const gift = await prisma.giftAccount.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!gift) throw new NotFoundError("Gift account");

  const started = await prisma.giftAccount.updateMany({
    where: { id: gift.id, claimedAt: null },
    data: { staffEditStartedAt: new Date() },
  });
  if (started.count === 0) {
    throw new AppError(
      "This account has been claimed. Only its owner can edit it now.",
      StatusCodes.CONFLICT
    );
  }
};

/**
 * DELETE /api/v1/admin/gift-accounts/:userId — remove an unclaimed gift
 * account (profile, links and theme go with it). Claimed accounts belong to
 * their owner and can't be deleted here.
 */
export const deleteGiftAccount = async (userId: string, actorId: string) => {
  const gift = await prisma.giftAccount.findUnique({
    where: { userId },
    select: {
      id: true,
      user: { select: { name: true, email: true, profile: { select: { username: true } } } },
    },
  });
  if (!gift) throw new NotFoundError("Gift account");
  const username = gift.user.profile?.username ?? null;

  await prisma.$transaction(async (tx) => {
    // Guard on claimedAt inside the transaction so a racing claim wins cleanly.
    const removed = await tx.giftAccount.deleteMany({
      where: { id: gift.id, claimedAt: null },
    });
    if (removed.count === 0) {
      throw new AppError(
        "This account has been claimed and can't be deleted by staff.",
        StatusCodes.CONFLICT
      );
    }
    await tx.user.delete({ where: { id: userId } });
    await recordGiftAudit(
      actorId,
      userId,
      "delete",
      { name: gift.user.name, email: gift.user.email, username },
      tx
    );
  });

  await bustPublicProfileCache(username);

  return ServiceResponse.success("Gift account deleted", null);
};

/** True when the user is a gift account nobody has claimed yet. */
export const isUnclaimedGiftAccount = async (userId: string) => {
  const gift = await prisma.giftAccount.findUnique({
    where: { userId },
    select: { claimedAt: true },
  });
  return !!gift && !gift.claimedAt;
};

/**
 * POST /api/v1/admin/gift-accounts/:userId/claim-link
 * Issues a fresh token (the previous one stops working) and optionally emails it.
 */
export const issueClaimLink = async (
  userId: string,
  body: TIssueClaimLink,
  actorId: string
) => {
  const gift = await prisma.giftAccount.findUnique({
    where: { userId },
    select: {
      claimedAt: true,
      user: { select: { email: true, name: true } },
    },
  });
  if (!gift) throw new NotFoundError("Gift account");
  if (gift.claimedAt) {
    throw new AppError(
      "This account has already been claimed.",
      StatusCodes.CONFLICT
    );
  }

  let email = gift.user.email;
  const emailChanged = !!body.email && body.email !== gift.user.email;
  if (emailChanged) {
    await assertEmailAvailable(body.email!, userId);
    email = body.email!;
  }

  const { raw, hash } = createRawToken(32);
  const expiresAt = new Date(Date.now() + CLAIM_LINK_TTL_MS);

  try {
    await prisma.$transaction(async (tx) => {
      // Guard on claimedAt so a claim racing with re-issue can't be undone.
      const updated = await tx.giftAccount.updateMany({
        where: { userId, claimedAt: null },
        data: { claimTokenHash: hash, claimTokenExpiresAt: expiresAt },
      });
      if (updated.count === 0) {
        throw new AppError(
          "This account has already been claimed.",
          StatusCodes.CONFLICT
        );
      }
      if (emailChanged) {
        await tx.user.update({ where: { id: userId }, data: { email } });
      }
      await recordGiftAudit(
        actorId,
        userId,
        "claim_link.issue",
        { emailChanged, sendEmail: body.sendEmail },
        tx
      );
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("A user with this email already exists.");
    }
    throw error;
  }

  const claim = await deliverClaimLink(
    raw,
    expiresAt,
    { email, name: gift.user.name },
    body.sendEmail
  );

  return ServiceResponse.success(
    "Claim link issued successfully",
    claim,
    StatusCodes.CREATED
  );
};

/**
 * Called by POST /api/v1/auth/reset-password when the token is not a normal
 * reset token. If it is a valid, unused claim token, the recipient's password
 * is set, staff edit access ends and the standard verification email is sent
 * (they can sign in once the address is verified, so a lost card can't be
 * used to take over the account).
 *
 * Returns false when the token is not a usable claim token.
 */
export const claimGiftAccountByToken = async (
  rawToken: string,
  password: string
): Promise<boolean> => {
  const tokenHash = hashRawToken(rawToken);
  const gift = await prisma.giftAccount.findUnique({
    where: { claimTokenHash: tokenHash },
    select: {
      id: true,
      claimedAt: true,
      claimTokenExpiresAt: true,
      user: { select: { id: true, name: true, email: true, active: true } },
    },
  });

  const now = new Date();
  if (
    !gift ||
    gift.claimedAt ||
    !gift.claimTokenExpiresAt ||
    gift.claimTokenExpiresAt <= now ||
    !gift.user.active
  ) {
    return false;
  }

  const verification = createRawToken(32);
  const passwordHash = await hashPassword(password);

  const editCutoff = new Date(now.getTime() - STAFF_EDIT_WINDOW_MS);
  const claimed = await prisma.$transaction(async (tx) => {
    // Single use: only one request can flip this row, even when racing.
    // Also waits out any staff edit that may still be in flight.
    const consumed = await tx.giftAccount.updateMany({
      where: {
        id: gift.id,
        claimTokenHash: tokenHash,
        claimedAt: null,
        claimTokenExpiresAt: { gt: now },
        OR: [{ staffEditStartedAt: null }, { staffEditStartedAt: { lt: editCutoff } }],
      },
      data: { claimedAt: now, claimTokenHash: null, claimTokenExpiresAt: null },
    });
    if (consumed.count === 0) return false;

    await tx.user.update({
      where: { id: gift.user.id },
      data: {
        password: passwordHash,
        passwordChangedAt: now,
        isEmailVerified: false,
        emailVerificationToken: verification.hash,
        emailVerificationExpires: new Date(now.getTime() + EMAIL_VERIFY_TTL_MS),
        notifyOnLinkTap: true,
      },
    });
    return true;
  });
  if (!claimed) {
    const current = await prisma.giftAccount.findUnique({
      where: { id: gift.id },
      select: { claimedAt: true, staffEditStartedAt: true },
    });
    if (!current?.claimedAt && current?.staffEditStartedAt && current.staffEditStartedAt >= editCutoff) {
      throw new AppError(
        "Your page is being updated by the Abio team right now. Please try again in a minute.",
        StatusCodes.CONFLICT
      );
    }
    return false;
  }

  await revokeAllRefreshTokensForUser(gift.user.id);

  try {
    await enqueueVerificationEmail({
      to: gift.user.email,
      name: gift.user.name,
      verifyUrl: buildEmailVerificationUrl(verification.raw),
    });
  } catch (error) {
    // The account is claimed; the owner can use "resend verification email".
    logger.error({ err: error }, "Failed to enqueue gift claim verification email");
  }

  return true;
};
