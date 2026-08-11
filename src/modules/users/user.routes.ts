import express, { type Router } from "express";
import { authenticate } from "@/shared/middleware/auth.middleware";
import * as userController from "./user.controller";

const userRouter: Router = express.Router();

userRouter.get("/", authenticate, userController.getLoggedInUser);
userRouter.delete("/", authenticate, userController.deleteMyAccount);
userRouter.patch(
  "/profile/email",
  authenticate,
  userController.updateEmail
);

export default userRouter;
