import {
  bearerSecurity,
  errorResponseContent,
  pageLimitParams,
  serviceResponseContent,
  uuidPath,
} from "./helpers";

export const settingsSchemas = {
  PrivacyVisibility: {
    type: "string",
    enum: ["public", "private"],
  },
  PrivacySettings: {
    type: "object",
    properties: {
      visibility: { $ref: "#/components/schemas/PrivacyVisibility" },
    },
    example: { visibility: "public" },
  },
  UpdatePrivacyInput: {
    type: "object",
    required: ["visibility"],
    properties: {
      visibility: { $ref: "#/components/schemas/PrivacyVisibility" },
    },
    example: { visibility: "private" },
  },
  NotificationSettings: {
    type: "object",
    properties: {
      emailOnLinkTap: {
        type: "boolean",
        description: "Email the owner whenever a visitor taps any of their links",
      },
    },
    example: { emailOnLinkTap: true },
  },
  UpdateNotificationsInput: {
    type: "object",
    required: ["emailOnLinkTap"],
    properties: {
      emailOnLinkTap: { type: "boolean" },
    },
    example: { emailOnLinkTap: false },
  },
  CreateBusinessInquiryInput: {
    type: "object",
    required: [
      "companyName",
      "fullName",
      "email",
      "phone",
      "companySize",
      "industry",
    ],
    properties: {
      companyName: { type: "string", example: "Acme Corp" },
      fullName: { type: "string", example: "Ada Lovelace" },
      email: { type: "string", format: "email", example: "ada@acme.com" },
      phone: {
        type: "string",
        example: "+2348012345678",
        description: "Any recognizable international format; normalized to E.164 server-side",
      },
      companySize: { type: "string", example: "11-50" },
      industry: { type: "string", example: "Retail" },
      features: {
        type: "array",
        items: { type: "string" },
        example: ["Access control (unlock doors)", "Advanced analytics"],
        description: "Optional — omit or send [] if nothing is selected",
      },
    },
    example: {
      companyName: "Acme Corp",
      fullName: "Ada Lovelace",
      email: "ada@acme.com",
      phone: "+2348012345678",
      companySize: "11-50",
      industry: "Retail",
      features: ["Advanced analytics"],
    },
  },
  BusinessInquiry: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      userId: { type: "string", format: "uuid" },
      companyName: { type: "string" },
      fullName: { type: "string" },
      email: { type: "string", format: "email" },
      phone: { type: "string" },
      companySize: { type: "string" },
      industry: { type: "string" },
      features: { type: "array", items: { type: "string" } },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },
};

export const settingsPaths = {
  "/api/v1/user/settings/privacy": {
    get: {
      tags: ["User — Settings"],
      summary: "Get privacy settings",
      description:
        "**Audience: Authenticated user.** Thin wrapper over `Profile.isPublic`.",
      security: bearerSecurity,
      responses: {
        "200": { description: "Privacy settings", content: serviceResponseContent },
        "401": { description: "Unauthenticated", content: errorResponseContent },
        "404": { description: "Profile not found", content: errorResponseContent },
      },
    },
    patch: {
      tags: ["User — Settings"],
      summary: "Update profile visibility",
      description:
        "**Audience: Authenticated user.** Setting `private` makes `GET /user/:username` and public link-click tracking 404.",
      security: bearerSecurity,
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/UpdatePrivacyInput" },
          },
        },
      },
      responses: {
        "200": { description: "Updated", content: serviceResponseContent },
        "401": { description: "Unauthenticated", content: errorResponseContent },
        "404": { description: "Profile not found", content: errorResponseContent },
      },
    },
  },

  "/api/v1/user/settings/notifications": {
    get: {
      tags: ["User — Settings"],
      summary: "Get notification settings",
      security: bearerSecurity,
      responses: {
        "200": { description: "Notification settings", content: serviceResponseContent },
        "401": { description: "Unauthenticated", content: errorResponseContent },
      },
    },
    patch: {
      tags: ["User — Settings"],
      summary: "Update notification settings",
      description:
        "**Audience: Authenticated user.** Toggles the async 'someone tapped your link' email, sent via the existing email queue.",
      security: bearerSecurity,
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/UpdateNotificationsInput" },
          },
        },
      },
      responses: {
        "200": { description: "Updated", content: serviceResponseContent },
        "401": { description: "Unauthenticated", content: errorResponseContent },
      },
    },
  },

  "/api/v1/user/business-inquiries": {
    post: {
      tags: ["User — Business Inquiries"],
      summary: "Submit \"Grow with Abio\" lead form",
      description:
        "**Audience: Authenticated user.** Lead capture only — does not change account type. Repeat submissions are allowed.",
      security: bearerSecurity,
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CreateBusinessInquiryInput" },
          },
        },
      },
      responses: {
        "201": {
          description: "Inquiry created",
          content: serviceResponseContent,
        },
        "400": { description: "Validation error", content: errorResponseContent },
        "401": { description: "Unauthenticated", content: errorResponseContent },
      },
    },
  },

  "/api/v1/admin/business-inquiries": {
    get: {
      tags: ["Admin — Business Inquiries"],
      summary: "List \"Grow with Abio\" leads",
      description:
        "**Audience: Admin / Moderator.** Search with `q` (matches company name, full name, or email).",
      security: bearerSecurity,
      parameters: [
        ...pageLimitParams,
        {
          name: "q",
          in: "query",
          required: false,
          schema: { type: "string", example: "Acme" },
          description: "Search company name, full name, or email (case-insensitive)",
        },
      ],
      responses: {
        "200": {
          description: "Paginated inquiries (includes submitting user summary)",
          content: serviceResponseContent,
        },
        "401": { description: "Unauthenticated", content: errorResponseContent },
        "403": { description: "Not staff", content: errorResponseContent },
      },
    },
  },

  "/api/v1/admin/business-inquiries/{id}": {
    get: {
      tags: ["Admin — Business Inquiries"],
      summary: "Get a single \"Grow with Abio\" lead",
      description: "**Audience: Admin / Moderator.**",
      security: bearerSecurity,
      parameters: [uuidPath("id")],
      responses: {
        "200": {
          description: "Inquiry (includes submitting user summary)",
          content: serviceResponseContent,
        },
        "401": { description: "Unauthenticated", content: errorResponseContent },
        "403": { description: "Not staff", content: errorResponseContent },
        "404": { description: "Not found", content: errorResponseContent },
      },
    },
  },
};
