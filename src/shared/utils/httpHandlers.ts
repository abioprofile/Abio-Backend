import type { NextFunction, Request, Response } from "express";
import type { ZodSchema, z } from "zod";

import { ServiceResponse } from "@/shared/utils/serviceResponse";

export const handleServiceResponse = (
  serviceResponse: ServiceResponse<any>,
  response: Response
) => {
  return response.status(serviceResponse.statusCode).json(serviceResponse);
};

/** Middleware-style validation (legacy routers). Prefer `parseRequest` in new modules. */
export const validateRequest =
  (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse({ body: req.body, query: req.query, params: req.params });
      next();
    } catch (err) {
      next(err);
    }
  };

/**
 * Parse request parts in a controller. Throws ZodError on failure (→ 400 via errorHandler).
 */
export function parseRequest<T extends ZodSchema>(
  schema: T,
  req: Pick<Request, "body" | "query" | "params">
): z.infer<T> {
  return schema.parse({
    body: req.body,
    query: req.query,
    params: req.params,
  });
}
