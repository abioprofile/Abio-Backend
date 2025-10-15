import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { pino } from "pino";
import path from "path";

import globalErrorHandler, {
  unexpectedRequest,
} from "@/middleware/errorHandler";
import authRouter from "@/routes/auth.router";
import userRouter from "@/routes/user.router";
import waitlistRouter from "@/routes/waitlist.router";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import env from "@/env";
import { prisma } from "@/lib/prisma";

const logger = pino({ name: "server start" });
const app: Express = express();

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Set the application to trust the reverse proxy
app.set("trust proxy", true);

// Set up Pug as view engine
app.set("view engine", "pug");
app.set("views", path.join(process.cwd(), "views"));

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(helmet());

// Routes
app.use("/api/v1/user", userRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/waitlist", waitlistRouter);

// Error handlers
app.use(unexpectedRequest);
app.use(globalErrorHandler);

export { app, logger, prisma, env };
