import express, { type Router } from "express";
import * as waitlistController from "./waitlist.controller";

const waitlistRouter: Router = express.Router();

waitlistRouter.post("/", waitlistController.create);
waitlistRouter.get("/jzI27AUJTCKU", waitlistController.getAll);

export default waitlistRouter;
