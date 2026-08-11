import supertest from "supertest";
import { app } from "@/server";

/** Supertest client against the Express app (no listen). */
export const testApp = supertest(app);
