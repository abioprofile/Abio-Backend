import crypto from "crypto";
import jwt from "jsonwebtoken";
import env from "@/env";
import { prisma } from "@/shared/config/database";

const hashToken = (raw: string) =>
  crypto.createHash("sha256").update(raw).digest("hex");

/** Random URL-safe token + DB hash (Medicore-style email verify / refresh). */
export const createRawToken = (bytes = 32) => {
  const raw = crypto.randomBytes(bytes).toString("hex");
  return { raw, hash: hashToken(raw) };
};

export const hashRawToken = hashToken;

export type AccessTokenPayload = {
  id: string;
  typ: "access";
};

export const signAccessToken = (userId: string): string => {
  const payload: AccessTokenPayload = { id: userId, typ: "access" };
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
};

/** Parse durations like `15m`, `7d`, `90` (days, legacy cookie days). */
export const durationToMs = (value: string): number => {
  const trimmed = value.trim();
  const match = /^(\d+)([smhd])?$/i.exec(trimmed);
  if (!match) {
    return Number(trimmed) * 24 * 60 * 60 * 1000;
  }
  const amount = Number(match[1]);
  const unit = (match[2] || "d").toLowerCase();
  switch (unit) {
    case "s":
      return amount * 1000;
    case "m":
      return amount * 60 * 1000;
    case "h":
      return amount * 60 * 60 * 1000;
    case "d":
    default:
      return amount * 24 * 60 * 60 * 1000;
  }
};

/**
 * Issue opaque refresh token, store only the hash.
 * Client gets `raw`; DB never stores the raw value.
 */
export const issueRefreshToken = async (userId: string): Promise<string> => {
  const { raw, hash } = createRawToken(40);
  const expiresAt = new Date(
    Date.now() + durationToMs(env.JWT_REFRESH_EXPIRES_IN)
  );

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hash,
      expiresAt,
    },
  });

  return raw;
};

export const rotateRefreshToken = async (
  rawRefreshToken: string
): Promise<{ userId: string; refreshToken: string; accessToken: string }> => {
  const tokenHash = hashRawToken(rawRefreshToken);
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash },
  });

  if (!existing || existing.expiresAt.getTime() < Date.now()) {
    if (existing) {
      await prisma.refreshToken.delete({ where: { id: existing.id } }).catch(() => {});
    }
    throw new Error("INVALID_REFRESH_TOKEN");
  }

  // Rotate: delete old, issue new (stolen-token reuse fails after rotation)
  await prisma.refreshToken.delete({ where: { id: existing.id } });

  const accessToken = signAccessToken(existing.userId);
  const refreshToken = await issueRefreshToken(existing.userId);

  return { userId: existing.userId, accessToken, refreshToken };
};

export const revokeRefreshToken = async (rawRefreshToken: string) => {
  const tokenHash = hashRawToken(rawRefreshToken);
  await prisma.refreshToken.deleteMany({ where: { tokenHash } });
};

export const revokeAllRefreshTokensForUser = async (userId: string) => {
  await prisma.refreshToken.deleteMany({ where: { userId } });
};

export const issueAuthTokens = async (userId: string) => {
  const accessToken = signAccessToken(userId);
  const refreshToken = await issueRefreshToken(userId);
  return { accessToken, refreshToken };
};

/** Frontend click-through URL: `${CLIENT_URL}/auth/<rawToken>` */
export const buildEmailVerificationUrl = (rawToken: string) =>
  `${env.CLIENT_URL}/auth/${rawToken}`;

/** Frontend reset form: `${CLIENT_URL}/auth/reset-password/<rawToken>` */
export const buildPasswordResetUrl = (rawToken: string) =>
  `${env.CLIENT_URL}/auth/reset-password/${rawToken}`;
