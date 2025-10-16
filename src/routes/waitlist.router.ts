import WaitlistController from "@/controllers/waitlist.controller";
import { createWaitlistSchema } from "@/schemas/waitlist.schema";
import { validateRequest } from "@/utils/httpHandlers";
import express, { type Router } from "express";

export const waitlistRouter: Router = express.Router();

waitlistRouter.post(
  "/",
  validateRequest(createWaitlistSchema),
  WaitlistController.create
);

waitlistRouter.get("/jzI27AUJTCKU", WaitlistController.getAll);

export default waitlistRouter;
