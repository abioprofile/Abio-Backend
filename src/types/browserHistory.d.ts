import { Request } from "express";
import { TCategorizeBrowserHistory } from "@/schemas/browserHistory.schema";

export interface CategorizeRequest extends Request {
  body: TCategorizeBrowserHistory;
}
