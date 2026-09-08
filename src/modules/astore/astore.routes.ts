import { Router } from "express";
import { authenticate, hasRole } from "@/shared/middleware/auth.middleware";
import * as astoreController from "./astore.controller";

const astoreRouter = Router();
const requireStaff = [authenticate, hasRole(["admin", "moderator"])] as const;

astoreRouter.get("/products", ...requireStaff, astoreController.listProducts);
astoreRouter.post("/products", ...requireStaff, astoreController.createProduct);
astoreRouter.get(
  "/products/:id",
  ...requireStaff,
  astoreController.getProductById
);
astoreRouter.patch(
  "/products/:id",
  ...requireStaff,
  astoreController.updateProduct
);
astoreRouter.post(
  "/products/:id/variants",
  ...requireStaff,
  astoreController.createVariant
);
astoreRouter.patch(
  "/products/:id/variants/:variantId",
  ...requireStaff,
  astoreController.updateVariant
);

astoreRouter.get("/metrics", ...requireStaff, astoreController.getMetrics);

astoreRouter.get("/orders", ...requireStaff, astoreController.listOrders);
astoreRouter.get("/orders/:id", ...requireStaff, astoreController.getOrderById);
astoreRouter.patch("/orders/:id", ...requireStaff, astoreController.updateOrder);

export default astoreRouter;
