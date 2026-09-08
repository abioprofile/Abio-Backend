import { Router } from "express";
import * as publicController from "./astore.public.controller";

/** Unauthenticated shop catalog */
const astorePublicRouter = Router();

astorePublicRouter.get("/products", publicController.listPublicProducts);
astorePublicRouter.get(
  "/products/:idOrSlug",
  publicController.getPublicProduct
);

export default astorePublicRouter;
