import { Router } from "express";
import { authenticate } from "@/shared/middleware/auth.middleware";
import * as analyticsController from "./analytics.controller";

const analyticsRouter = Router();

analyticsRouter.use(authenticate);

analyticsRouter.get("/summary", analyticsController.getSummary);
analyticsRouter.get("/daily", analyticsController.getDaily);
analyticsRouter.get("/links", analyticsController.getTopLinks);

export default analyticsRouter;
