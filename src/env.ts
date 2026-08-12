import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  HOST: z.string(),
  BACKEND_URL: z.string().url(),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DATABASE_URL: z.string().url(),
  TEST_DATABASE_URL: z.string().url().optional(),
  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string(),
  CLOUDINARY_API_KEY: z.string(),
  CLOUDINARY_API_SECRET: z.string(),
  CORS_ORIGINS: z
    .string()
    .transform((val) => val.split(",").map((url) => url.trim()))
    .pipe(z.array(z.string())),
  COOKIE_DOMAIN: z.string(),
  JWT_SECRET: z.string(),
  /** @deprecated use JWT_ACCESS_EXPIRES_IN — kept for older envs */
  JWT_EXPIRES_IN: z.string().optional(),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  JWT_COOKIE_EXPIRES_IN: z.string().default("7"),
  EMAIL_FROM: z.string().email(),
  EMAIL_FROM_NAME: z.string(),
  SMTP_HOST: z.string(),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_USERNAME: z.string(),
  SMTP_PASSWORD: z.string(),
  CLIENT_URL: z.string().url(),
  GOOGLE_OAUTH_CLIENT_ID: z.string(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string(),
  GOOGLE_OAUTH_PROJECT_ID: z.string(),
  GOOGLE_OAUTH_CALLBACK_URL: z.string(),
  REDIS_URL: z.string().url(),
  TOTP_SECRET: z.string(),
  LOG_LEVEL: z.string().default("info")
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ Invalid environment variables:", parsedEnv.error.format());
  throw new Error("Invalid configuration. See console for details.");
}

const data = parsedEnv.data;

/** Prefer JWT_ACCESS_EXPIRES_IN; fall back to legacy JWT_EXPIRES_IN. */
export default {
  ...data,
  JWT_ACCESS_EXPIRES_IN:
    data.JWT_ACCESS_EXPIRES_IN || data.JWT_EXPIRES_IN || "15m",
};
export type Env = typeof data;
