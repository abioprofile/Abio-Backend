import LinkController from "@/controllers/link.controller";
import { validateRequest } from "@/utils/httpHandlers";
import { UUIDSchema } from "@/schemas/index";
import express, { type Router } from "express";

export const publicRouter: Router = express.Router();

// Track link click (public endpoint for analytics)
publicRouter.post(
  "/links/:id/click",
  validateRequest(UUIDSchema),
  LinkController.trackClick
);

export default publicRouter;
