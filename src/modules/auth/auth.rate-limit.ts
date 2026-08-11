import rateLimit from "express-rate-limit";
import env from "@/env";

/**
 * Brute-force shield for credential stuffing on login.
 * Tests get a high ceiling so the suite doesn't flake.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === "test" ? 1_000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Please try again later.",
    data: null,
    statusCode: 429,
  },
});
