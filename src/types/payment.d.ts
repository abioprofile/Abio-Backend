import { AuthenticatedRequest } from "@/types/express";
import { TCreateCheckoutSession } from "@/schemas/payment.schema";

export interface CreateCheckoutSessionRequest extends AuthenticatedRequest {
  body: TCreateCheckoutSession;
}
