import express, { type Router } from "express";
import { authenticate } from "@/shared/middleware/auth.middleware";
import { uploadImage } from "@/shared/middleware/upload.middleware";
import * as linkController from "./link.controller";

const linkRouter: Router = express.Router();

linkRouter.use(authenticate);

linkRouter.get("/", linkController.getAll);
linkRouter.post("/", linkController.create);

// Static path before "/:id" so "reorder" is never treated as an id
linkRouter.patch("/reorder/all", linkController.reorder);

linkRouter.get("/:id", linkController.getById);
linkRouter.patch("/:id", linkController.update);
linkRouter.patch(
  "/:id/icon",
  uploadImage.single("icon"),
  linkController.updateLinkIcon
);
linkRouter.delete("/:id", linkController.deleteLink);

export default linkRouter;
