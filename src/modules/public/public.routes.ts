import express, { type Router } from "express";
import * as publicController from "./public.controller";

const publicRouter: Router = express.Router();

publicRouter.post("/links/:id/click", publicController.trackLinkClick);

export default publicRouter;
