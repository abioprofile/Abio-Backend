import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import path from "path";

import globalErrorHandler, {
	unexpectedRequest,
} from "@/shared/middleware/errorHandler";
import authRouter from "@/modules/auth/auth.routes";
import userRouter from "@/modules/users/user.routes";
import profileRouter from "@/modules/profiles/profile.routes";
import preferencesRouter from "@/modules/preferences/preferences.routes";
import waitlistRouter from "@/modules/waitlist/waitlist.routes";
import linkRouter from "@/modules/links/link.routes";
import publicRouter from "@/modules/public/public.routes";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import env from "@/env";
import { prisma } from "@/lib/prisma";
import logger from "@/shared/config/logger";
import setupPassport from "@/modules/auth/passport";
import passport from "passport";
import themesRouter from "@/modules/themes/themes.routes";
import { requestLogger } from "@/shared/middleware/requestLogger";
import { setupSwagger } from "@/docs/swagger";
import adminRouter from "@/modules/admin/admin.routes";
import astoreRouter from "@/modules/astore/astore.routes";
import astorePublicRouter from "@/modules/astore/astore.public.routes";
import cartRouter from "@/modules/cart/cart.routes";
import ordersRouter from "@/modules/orders/orders.routes";
import paymentsWebhookRouter from "@/modules/payments/payments.webhook.routes";
const app: Express = express();

if (process.env.NODE_ENV === "development") {
	app.use(morgan("dev"));
}

// Set the application to trust the reverse proxy
app.set("trust proxy", true);

// Set up Pug as view engine
app.set("view engine", "pug");
app.set("views", path.join(process.cwd(), "views"));

// Bachs webhooks need the raw body for HMAC — mount before express.json()
app.use("/api/v1/payments/webhooks", paymentsWebhookRouter);

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

// User feature routers share /api/v1/user — profiles last (has /:username)
app.use("/api/v1/user", userRouter);
app.use("/api/v1/user", preferencesRouter);
app.use("/api/v1/user", profileRouter);

const router = express.Router();
router.use("/waitlist", waitlistRouter);
router.use("/auth", authRouter);
router.use("/links", linkRouter);
router.use("/public", publicRouter);

app.use("/api/v1", router);

app.use("/api/v1/themes", themesRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/admin/astore", astoreRouter);
app.use("/api/v1/astore", astorePublicRouter);
app.use("/api/v1/cart", cartRouter);
app.use("/api/v1/orders", ordersRouter);
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
