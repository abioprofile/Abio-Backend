import crypto from "crypto";
import jwt from "jsonwebtoken";
import cache from "@/lib/cache";

const blacklistKey = (token: string) =>
  `auth:blacklist:${crypto.createHash("sha256").update(token).digest("hex")}`;

/** Seconds until JWT `exp`, floored to at least 1. */
const ttlSecondsFromToken = (token: string): number => {
  const decoded = jwt.decode(token) as jwt.JwtPayload | null;
  if (!decoded?.exp) {
    // Fallback when token has no exp — keep blacklist briefly
    return 60 * 60;
  }
  const remaining = decoded.exp - Math.floor(Date.now() / 1000);
  return Math.max(remaining, 1);
};

/** Mark a JWT unusable until it would have expired anyway. */
export const blacklistToken = async (token: string): Promise<void> => {
  await cache.setex(blacklistKey(token), ttlSecondsFromToken(token), "1");
};

export const isTokenBlacklisted = async (token: string): Promise<boolean> => {
  const hit = await cache.get(blacklistKey(token));
  return hit !== null;
};
