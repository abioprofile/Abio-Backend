import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import path from "path";

import globalErrorHandler, {
	unexpectedRequest,
} from "@/shared/middleware/errorHandler";
import authRouter from "@/routes/auth.router";
import userRouter from "@/routes/user.router";
import waitlistRouter from "@/modules/waitlist/waitlist.routes";
import linkRouter from "@/modules/links/link.routes";
import publicRouter from "@/routes/public.router";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import env from "@/env";
import { prisma } from "@/lib/prisma";
import logger from "@/shared/config/logger";
import setupPassport from "@/service/passport";
import passport from "passport";
import themesRouter from "@/modules/themes/themes.routes";
import { requestLogger } from "@/shared/middleware/requestLogger";
import { setupSwagger } from "@/docs/swagger";

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
app.use(requestLogger as any);
app.use(
	cors({
		origin: env.CORS_ORIGINS,
		credentials: true,
	})
);
app.use(helmet());

const pp = setupPassport(passport);
app.use(pp.initialize());

// Routes
app.use("/api/v1/user", userRouter);

const router = express.Router();
router.use("/waitlist", waitlistRouter);
router.use("/auth", authRouter);
router.use("/links", linkRouter);
router.use("/public", publicRouter);

app.use("/api/v1", router);

app.use("/api/v1/themes", themesRouter);

app.get("/health", (_req, res) => {
	res.json({
		status: "ok",
		environment: env.NODE_ENV,
		timestamp: new Date().toISOString(),
	})
})

setupSwagger(app);

// Error handlers
app.use(unexpectedRequest);
app.use(globalErrorHandler);

export { app, logger, prisma, env };
