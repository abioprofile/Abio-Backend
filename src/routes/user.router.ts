import UserController from "@/controllers/user.controller";
import { authenticate, hasProfile } from "@/middleware/auth.middleware";
import {
	UUIDSchema,
	updateProfileSchema,
	checkUsernameSchema,
} from "@/schemas/index";
import {
	createUserSchema,
	updateUserSchema,
	deleteAccountSchema,
	updateEmailSchema,
} from "@/schemas/user.schema";
import ProfileController from "../controllers/profile.controller";
import { validateRequest } from "@/utils/httpHandlers";
import { uploadImage } from "@/middleware/upload.middleware";
import express, { type Router } from "express";
import { updateBackgroundSchema, updateCornersSchema, updateFontSchema, updatePreferencesSchema } from "@/schemas/profile.schema";

export const userRouter: Router = express.Router();

// Public routes
userRouter.post(
	"/signup",
	validateRequest(createUserSchema),
	UserController.createUser,
);

// Check username availability (public)
userRouter.get(
	"/check-username",
	validateRequest(checkUsernameSchema),
	ProfileController.checkUsername,
);

// Protected routes - require authentication
userRouter.get("/", authenticate, UserController.getLoggedInUser);

// Delete account route
userRouter.delete(
	"/",
	authenticate,
	validateRequest(deleteAccountSchema),
	UserController.deleteMyAccount,
);

// Profile routes
userRouter.get("/profile", authenticate, ProfileController.getMyProfile);
userRouter.patch(
	"/profile",
	authenticate,
	validateRequest(updateProfileSchema),
	ProfileController.updateMyProfile,
);
userRouter.patch(
	"/profile/avatar",
	authenticate,
	uploadImage.single("avatar"),
	ProfileController.updateAvatar,
);

userRouter.patch(
	"/profile/email",
	authenticate,
	validateRequest(updateEmailSchema),
	UserController.updateEmail,
);

userRouter.get("/preferences", authenticate, ProfileController.getDisplaySettings);

userRouter.put(
	"/preferences/background",
	authenticate,
	uploadImage.single('image'),
	validateRequest(updateBackgroundSchema),
	ProfileController.updateStylePreference,
);
userRouter.put(
	"/preferences/fonts",
	authenticate,
	validateRequest(updateFontSchema),
	ProfileController.updateFontsPreference,
);
userRouter.put(
	"/preferences/corners",
	authenticate,
	validateRequest(updateCornersSchema),
	ProfileController.updateCornerPreference,
);

userRouter.put("/preferences", validateRequest(updatePreferencesSchema), authenticate,
	ProfileController.updatePreferences);

// Public profile route (must be last - matches any username)
userRouter.get("/:username", ProfileController.getPublicProfile);

export default userRouter;
