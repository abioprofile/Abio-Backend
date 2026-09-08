import { Router, type Request, type Response, type NextFunction } from "express";
import express from "express";
import * as webhookController from "./payments.webhook.controller";

const paymentsWebhookRouter = Router();

/**
 * Must keep the raw body bytes for HMAC verification.
 * Mount this router with express.raw before express.json, or use this middleware.
 */
export const captureRawBody = (
  req: Request & { rawBody?: Buffer },
  _res: Response,
  next: NextFunction
) => {
  if (Buffer.isBuffer(req.body)) {
    req.rawBody = req.body;
  }
  next();
};

paymentsWebhookRouter.post(
  "/bach",
  express.raw({ type: "application/json" }),
  captureRawBody,
  webhookController.bachsWebhook
);

export default paymentsWebhookRouter;
