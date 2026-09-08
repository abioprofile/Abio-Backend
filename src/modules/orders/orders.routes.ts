import { Router } from "express";
import { authenticate } from "@/shared/middleware/auth.middleware";
import * as ordersController from "./orders.controller";

const ordersRouter = Router();

ordersRouter.use(authenticate);

ordersRouter.post("/checkout", ordersController.checkout);
ordersRouter.post("/:id/pay", ordersController.startPayment);
ordersRouter.get("/", ordersController.listMyOrders);
ordersRouter.get("/:id", ordersController.getMyOrderById);

export default ordersRouter;
