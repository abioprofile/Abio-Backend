import env from "@/env";
import Redis from "ioredis";

const cache = new Redis(env.REDIS_URL);

export default cache;

/**
 * Unique per deploy (Railway injects these automatically; "dev" locally).
 * Prefix any cache key whose cached value shape depends on the running
 * code with this, so a new deploy can never serve a response shape cached
 * by the previous one — Redis persists across deploys/restarts.
 */
export const DEPLOY_ID =
  process.env.RAILWAY_DEPLOYMENT_ID ??
  process.env.RAILWAY_GIT_COMMIT_SHA ??
  "dev";
