import express, { type Router } from "express";
import { authenticate, hasRole } from "@/shared/middleware/auth.middleware";
import { uploadImage } from "@/shared/middleware/upload.middleware";
import * as gift from "./gift-accounts.controller";

/**
 * Staff routes — mounted at /api/v1/admin/gift-accounts.
 * Admins and moderators can create gift accounts and build them out while
 * they are unclaimed.
 */
export const giftAccountsAdminRouter: Router = express.Router();

giftAccountsAdminRouter.use(authenticate, hasRole(["admin", "moderator"]));

giftAccountsAdminRouter.get("/", gift.list);
giftAccountsAdminRouter.post("/", gift.create);
giftAccountsAdminRouter.get("/:userId", gift.getOne);
giftAccountsAdminRouter.post("/:userId/claim-link", gift.issueClaimLink);
giftAccountsAdminRouter.delete("/:userId", gift.remove);

// Everything below edits the account, so it must still be unclaimed.
const editable = gift.requireEditableGiftAccount;

giftAccountsAdminRouter.patch("/:userId/profile", editable, gift.updateProfile);
giftAccountsAdminRouter.patch(
  "/:userId/profile/avatar",
  editable,
  uploadImage.single("avatar"),
  gift.updateAvatar
);
giftAccountsAdminRouter.delete(
  "/:userId/profile/avatar",
  editable,
  gift.deleteAvatar
);

giftAccountsAdminRouter.get("/:userId/preferences", editable, gift.getPreferences);
giftAccountsAdminRouter.put(
  "/:userId/preferences",
  editable,
  gift.updatePreferences
);
giftAccountsAdminRouter.post(
  "/:userId/preferences/wallpaper/image",
  editable,
  uploadImage.single("image"),
  gift.uploadWallpaper
);

giftAccountsAdminRouter.get("/:userId/links", editable, gift.listLinks);
giftAccountsAdminRouter.post("/:userId/links", editable, gift.createLink);
// Static path before "/:linkId" so "reorder" is never treated as an id
giftAccountsAdminRouter.patch(
  "/:userId/links/reorder/all",
  editable,
  gift.reorderLinks
);
giftAccountsAdminRouter.patch("/:userId/links/:linkId", editable, gift.updateLink);
giftAccountsAdminRouter.patch(
  "/:userId/links/:linkId/icon",
  editable,
  uploadImage.single("icon"),
  gift.updateLinkIcon
);
giftAccountsAdminRouter.delete(
  "/:userId/links/:linkId",
  editable,
  gift.deleteLink
);
