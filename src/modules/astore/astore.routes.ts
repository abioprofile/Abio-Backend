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

export default astoreRouter;
