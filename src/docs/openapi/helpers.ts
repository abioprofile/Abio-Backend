/** Shared OpenAPI helpers for Abio docs */

export const bearerSecurity = [{ bearerAuth: [] }] as const;

export const serviceResponseContent = {
  "application/json": {
    schema: { $ref: "#/components/schemas/ServiceResponse" },
  },
} as const;

export const errorResponseContent = {
  "application/json": {
    schema: { $ref: "#/components/schemas/ErrorResponse" },
  },
} as const;

/** Query params for paginated list endpoints */
export const pageLimitParams = [
  {
    name: "page",
    in: "query" as const,
    required: false,
    schema: { type: "string", example: "1" },
    description: "Page number (default 1)",
  },
  {
    name: "limit",
    in: "query" as const,
    required: false,
    schema: { type: "string", example: "10" },
    description: "Page size (default 10, max 100)",
  },
];

export const uuidPath = (name: string, description?: string) => ({
  name,
  in: "path" as const,
  required: true,
  schema: { type: "string", format: "uuid" },
  ...(description ? { description } : {}),
});
