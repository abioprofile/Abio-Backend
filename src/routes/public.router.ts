import express, { type Router } from "express";
import * as linkController from "@/modules/links/link.controller";

export const publicRouter: Router = express.Router();

// Track link click (public endpoint for analytics)
publicRouter.post("/links/:id/click", linkController.trackClick);

export default publicRouter;
