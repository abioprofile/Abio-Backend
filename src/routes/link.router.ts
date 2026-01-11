import LinkController from "@/controllers/link.controller";
import { authenticate } from "@/middleware/auth.middleware";
import {
  createLinkSchema,
  updateLinkSchema,
  reorderLinksSchema,
} from "@/schemas/link.schema";
import { UUIDSchema } from "@/schemas/index";
import { validateRequest } from "@/utils/httpHandlers";
import express, { type Router } from "express";
import { uploadImage } from "@/middleware/upload.middleware";

export const linkRouter: Router = express.Router();

// All link routes require authentication
linkRouter.use(authenticate);

// Link CRUD operations
linkRouter.get("/", LinkController.getAll);
linkRouter.post("/", validateRequest(createLinkSchema), LinkController.create);
linkRouter.get("/:id", validateRequest(UUIDSchema), LinkController.getById);
linkRouter.patch(
  "/:id",
  validateRequest(UUIDSchema),
  validateRequest(updateLinkSchema),
  LinkController.update
);
linkRouter.patch(
  "/:id/icon",
  validateRequest(UUIDSchema),
  uploadImage.single("icon"),
  LinkController.updateLinkIcon
);
linkRouter.delete("/:id", validateRequest(UUIDSchema), LinkController.delete);

// Reorder links
linkRouter.patch(
  "/reorder/all",
  validateRequest(reorderLinksSchema),
  LinkController.reorder
);

export default linkRouter;
