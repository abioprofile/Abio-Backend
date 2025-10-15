import { cleanEnv, str, num, port } from "envalid";
import dotenv from "dotenv";

dotenv.config();

export default cleanEnv(process.env, {
  PORT: port(),
  HOST: str(),
  BACKEND_URL: str(),
  NODE_ENV: str({ choices: ["development", "production", "test"] }),
  DATABASE_URL: str(),
  CORS_ORIGIN: str(),
  COOKIE_DOMAIN: str(),
  JWT_SECRET: str(),
  JWT_EXPIRES_IN: str(),
  JWT_COOKIE_EXPIRES_IN: str(),
  EMAIL_FROM: str(),
  EMAIL_FROM_NAME: str(),
  SMTP_HOST: str(),
  SMTP_USERNAME: str(),
  SMTP_PORT: str(),
  SMTP_PASSWORD: str(),
});
