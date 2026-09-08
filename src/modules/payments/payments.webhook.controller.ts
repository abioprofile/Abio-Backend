import type { Request, Response } from "express";
import catchAsync from "@/shared/utils/catchAsync";
import { handleServiceResponse } from "@/shared/utils/httpHandlers";
import { processBachsWebhookRequest } from "./payments.webhook.service";

type RawBodyRequest = Request & { rawBody?: Buffer };

export const bachsWebhook = catchAsync(
  async (req: RawBodyRequest, res: Response) => {
    const rawBody =
      req.rawBody?.toString("utf8") ||
      (typeof req.body === "string"
        ? req.body
        : Buffer.isBuffer(req.body)
          ? req.body.toString("utf8")
          : "");

    const serviceResponse = await processBachsWebhookRequest({
      rawBody,
      timestampHeader: req.header("X-Bachs-Timestamp") || undefined,
      signatureHeader: req.header("X-Bachs-Signature") || undefined,
    });

    return handleServiceResponse(serviceResponse, res);
  }
);
