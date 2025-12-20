import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  HOST: z.string(),
  BACKEND_URL: z.string().url(),
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
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
  JWT_EXPIRES_IN: z.string().default("90d"),
  JWT_COOKIE_EXPIRES_IN: z.string().default("90"),
  EMAIL_FROM: z.string().email(),
  EMAIL_FROM_NAME: z.string(),
  SMTP_HOST: z.string(),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_USERNAME: z.string(),
  SMTP_PASSWORD: z.string(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ Invalid environment variables:", parsedEnv.error.format());
  throw new Error("Invalid configuration. See console for details.");
}

export default parsedEnv.data;
export type Env = z.infer<typeof envSchema>;
