import rateLimit from "express-rate-limit";
import env from "@/env";

/**
 * Brute-force shield for credential stuffing on login.
 * Tests get a high ceiling so the suite doesn't flake.
 *
 * `trust proxy` is enabled on the app for reverse proxies; disable that
 * specific rate-limit validation so it doesn't throw ERR_ERL_PERMISSIVE_TRUST_PROXY.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === "test" ? 1_000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: {
    success: false,
    message: "Too many login attempts. Please try again later.",
    data: null,
    statusCode: 429,
  },
});
