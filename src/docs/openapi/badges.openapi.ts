import {
  bearerSecurity,
  errorResponseContent,
  pageLimitParams,
  serviceResponseContent,
  uuidPath,
} from "./helpers";

export const badgesSchemas = {
  BadgeRequestStatus: {
    type: "string",
    enum: ["pending", "approved", "rejected"],
  },
  BadgeRequest: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      userId: { type: "string", format: "uuid" },
      badgeType: { type: "string", example: "verified" },
      status: { $ref: "#/components/schemas/BadgeRequestStatus" },
      reason: { type: "string", example: "I am a verified creator on Abio." },
      idDocumentUrl: {
        type: "string",
        format: "uri",
        description: "Cloudinary URL of uploaded ID document (image or PDF)",
      },
      reviewedAt: { type: "string", format: "date-time", nullable: true },
      reviewedById: { type: "string", format: "uuid", nullable: true },
      reviewNote: {
        type: "string",
        nullable: true,
        description: "Admin note on reject (or direct-grant close message)",
      },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },
  RejectBadgeRequestInput: {
    type: "object",
    properties: {
      reason: {
        type: "string",
        maxLength: 500,
        example: "Document unclear",
      },
    },
  },
};

export const badgesPaths = {
  "/api/v1/user/badges/requests": {
    post: {
      tags: ["User — Badges"],
      summary: "Request a verification badge",
      description:
        "**Audience: Authenticated user.** Multipart form: `reason` (text) + `idDocument` (image or PDF). Blocked if an active badge or pending request already exists.",
      security: bearerSecurity,
      requestBody: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: {
              type: "object",
              required: ["reason", "idDocument"],
              properties: {
                reason: {
                  type: "string",
                  minLength: 10,
                  maxLength: 1000,
                  example: "I am a verified creator on Abio.",
                },
                idDocument: {
                  type: "string",
                  format: "binary",
                  description: "Government ID / proof document (image or PDF, max 5MB)",
                },
                badgeType: {
                  type: "string",
                  enum: ["verified"],
                  default: "verified",
                },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Request created (pending)",
          content: serviceResponseContent,
        },
        "400": {
          description: "Missing file / validation",
          content: errorResponseContent,
        },
        "409": {
          description: "Active badge or pending request already exists",
          content: errorResponseContent,
        },
        "401": { description: "Unauthenticated", content: errorResponseContent },
      },
    },
  },

  "/api/v1/user/badges/requests/me": {
    get: {
      tags: ["User — Badges"],
      summary: "My badge + latest request status",
      description:
        "**Audience: Authenticated user.** Returns `latestRequest`, `activeBadge`, and `hasActiveBadge`.",
      security: bearerSecurity,
      responses: {
        "200": { description: "Status", content: serviceResponseContent },
        "401": { description: "Unauthenticated", content: errorResponseContent },
      },
    },
  },

  "/api/v1/admin/badge-requests": {
    get: {
      tags: ["Admin — Badge Requests"],
      summary: "List verification requests",
      description:
        "**Audience: Admin / Moderator.** Review queue. Filter with `status=pending|approved|rejected`.",
      security: bearerSecurity,
      parameters: [
        ...pageLimitParams,
        {
          name: "status",
          in: "query",
          schema: { $ref: "#/components/schemas/BadgeRequestStatus" },
        },
      ],
      responses: {
        "200": {
          description: "Paginated requests (includes user summary)",
          content: serviceResponseContent,
        },
        "401": { description: "Unauthenticated", content: errorResponseContent },
        "403": { description: "Not staff", content: errorResponseContent },
      },
    },
  },

  "/api/v1/admin/badge-requests/{id}/approve": {
    post: {
      tags: ["Admin — Badge Requests"],
      summary: "Approve request and grant badge",
      description:
        "**Audience: Admin / Moderator.** Marks request approved and upserts an active `verified` badge.",
      security: bearerSecurity,
      parameters: [uuidPath("id")],
      responses: {
        "200": {
          description: "Approved (returns request + badge)",
          content: serviceResponseContent,
        },
        "404": { description: "Not found", content: errorResponseContent },
        "409": {
          description: "Not pending",
          content: errorResponseContent,
        },
        "401": { description: "Unauthenticated", content: errorResponseContent },
        "403": { description: "Not staff", content: errorResponseContent },
      },
    },
  },

  "/api/v1/admin/badge-requests/{id}/reject": {
    post: {
      tags: ["Admin — Badge Requests"],
      summary: "Reject verification request",
      description: "**Audience: Admin / Moderator.** Optional `{ reason }` stored as `reviewNote`.",
      security: bearerSecurity,
      parameters: [uuidPath("id")],
      requestBody: {
        required: false,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/RejectBadgeRequestInput" },
          },
        },
      },
      responses: {
        "200": { description: "Rejected", content: serviceResponseContent },
        "404": { description: "Not found", content: errorResponseContent },
        "409": {
          description: "Not pending",
          content: errorResponseContent,
        },
        "401": { description: "Unauthenticated", content: errorResponseContent },
        "403": { description: "Not staff", content: errorResponseContent },
      },
    },
  },
};
