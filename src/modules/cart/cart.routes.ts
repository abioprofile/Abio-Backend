import { Router } from "express";
import { authenticate } from "@/shared/middleware/auth.middleware";
import * as cartController from "./cart.controller";

const cartRouter = Router();

cartRouter.use(authenticate);

cartRouter.get("/", cartController.getCart);
cartRouter.delete("/", cartController.clearCart);
cartRouter.post("/items", cartController.addCartItem);
cartRouter.patch("/items/:itemId", cartController.updateCartItem);
cartRouter.delete("/items/:itemId", cartController.removeCartItem);

export default cartRouter;
