import {
  bearerSecurity,
  errorResponseContent,
  serviceResponseContent,
} from "./helpers";

const rangeParam = {
  name: "range",
  in: "query" as const,
  schema: { type: "string", enum: ["7d", "30d"], default: "30d" },
  description: "UTC window ending today (inclusive)",
};

export const analyticsSchemas = {
  AnalyticsSummary: {
    type: "object",
    properties: {
      range: { type: "string", enum: ["7d", "30d"] },
      from: { type: "string", example: "2026-08-11" },
      to: { type: "string", example: "2026-09-10" },
      views: { type: "integer" },
      clicks: { type: "integer" },
      clickRate: {
        type: "number",
        description: "clicks / views (0 if no views)",
        example: 0.25,
      },
    },
  },
};

export const analyticsPaths = {
  "/api/v1/public/profiles/{username}/view": {
    post: {
      tags: ["Public — Analytics"],
      summary: "Record a profile view",
      description:
        "**Audience: Public.** Fire-and-forget from the profile page. Does not use the cached GET profile path.",
      parameters: [
        {
          name: "username",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
      ],
      responses: {
        "200": {
          description: "View recorded",
          content: serviceResponseContent,
        },
        "404": {
          description: "Profile not found / not public",
          content: errorResponseContent,
        },
      },
    },
  },
  "/api/v1/analytics/summary": {
    get: {
      tags: ["User — Analytics"],
      summary: "Owner analytics summary",
      description:
        "**Audience: Authenticated user.** Views, clicks, and click rate for the owner's profile.",
      security: bearerSecurity,
      parameters: [rangeParam],
      responses: {
        "200": {
          description: "Summary",
          content: serviceResponseContent,
        },
        "401": { description: "Unauthorized", content: errorResponseContent },
      },
    },
  },
  "/api/v1/analytics/daily": {
    get: {
      tags: ["User — Analytics"],
      summary: "Owner daily trends",
      description:
        "**Audience: Authenticated user.** UTC daily views/clicks series (missing days filled with 0).",
      security: bearerSecurity,
      parameters: [rangeParam],
      responses: {
        "200": {
          description: "Daily series",
          content: serviceResponseContent,
        },
        "401": { description: "Unauthorized", content: errorResponseContent },
      },
    },
  },
  "/api/v1/analytics/links": {
    get: {
      tags: ["User — Analytics"],
      summary: "Top links by clicks",
      description:
        "**Audience: Authenticated user.** Link click ranking in the selected range.",
      security: bearerSecurity,
      parameters: [rangeParam],
      responses: {
        "200": {
          description: "Top links",
          content: serviceResponseContent,
        },
        "401": { description: "Unauthorized", content: errorResponseContent },
      },
    },
  },
};
