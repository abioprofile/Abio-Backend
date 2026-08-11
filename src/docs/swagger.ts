import swaggerUi from "swagger-ui-express";
import type { Express } from "express";
import env from "@/env";

const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "Abio API",
    version: "0.0.1",
    description: `
Abio.site backend API.

## Authentication
Protected endpoints accept a Bearer JWT in the Authorization header:
\`Authorization: Bearer <accessToken>\`

Some auth flows also set \`access\` / \`logged_in\` cookies.

## Response shape
All feature endpoints return a \`ServiceResponse\` envelope:
\`{ success, message, data, statusCode }\`
    `,
  },
  servers: [
    {
      url: env.BACKEND_URL,
      description: "Configured backend URL",
    },
    {
      url: `http://localhost:${env.PORT}`,
      description: "Local development",
    },
  ],
  tags: [
    { name: "Auth", description: "Signup, login, password reset, OAuth, 2FA" },
    { name: "Users", description: "Account and username checks" },
    { name: "Profiles", description: "Public/private profile and preferences" },
    { name: "Links", description: "Link CRUD, reorder, click tracking" },
    { name: "Themes", description: "Display themes" },
    { name: "Waitlist", description: "Waitlist signup" },
    { name: "Public", description: "Unauthenticated public profile views" },
    { name: "System", description: "Health check and system status" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT access token from login / signup",
      },
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "access",
        description: "HttpOnly access cookie set on login",
      },
    },
    schemas: {
      ServiceResponse: {
        type: "object",
        required: ["success", "message", "statusCode"],
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string", example: "Success" },
          data: { nullable: true },
          statusCode: { type: "integer", example: 200 },
        },
      },
      ErrorResponse: {
        type: "object",
        required: ["success", "message", "statusCode"],
        properties: {
          success: { type: "boolean", example: false },
          message: { type: "string", example: "Something went wrong!" },
          data: { nullable: true, example: null },
          statusCode: { type: "integer", example: 400 },
        },
      },
      Link: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          title: { type: "string", example: "GitHub" },
          url: { type: "string", example: "https://github.com/abio" },
          platform: { type: "string", nullable: true, example: "GITHUB" },
          displayOrder: { type: "integer", example: 0 },
          isVisible: { type: "boolean", example: true },
          clickCount: { type: "integer", example: 0 },
          icon_link: { type: "string", nullable: true },
          profileId: { type: "string", format: "uuid" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      CreateLinkInput: {
        type: "object",
        required: ["title", "url"],
        properties: {
          title: { type: "string", example: "GitHub" },
          url: {
            type: "string",
            example: "https://github.com/abio",
          },
          platform: {
            type: "string",
            example: "website",
            description:
              "Required when URL is not a recognized social platform",
          },
          isVisible: { type: "boolean", default: true },
        },
      },
      UpdateLinkInput: {
        type: "object",
        properties: {
          title: { type: "string" },
          url: { type: "string" },
          platform: { type: "string" },
          isVisible: { type: "boolean" },
          displayOrder: { type: "integer", minimum: 0 },
        },
      },
      ReorderLinksInput: {
        type: "object",
        required: ["links"],
        properties: {
          links: {
            type: "array",
            items: {
              type: "object",
              required: ["id", "displayOrder"],
              properties: {
                id: { type: "string", format: "uuid" },
                displayOrder: { type: "integer", minimum: 0 },
              },
            },
          },
        },
      },
      CreateWaitlistInput: {
        type: "object",
        required: ["name", "email"],
        properties: {
          name: { type: "string", example: "Ada Lovelace" },
          email: {
            type: "string",
            format: "email",
            example: "ada@example.com",
          },
        },
      },
      WaitlistEntry: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string", example: "Ada Lovelace" },
          email: { type: "string", format: "email" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["System"],
        summary: "API health check",
        description: "Public health check returning server status and timestamp.",
        responses: {
          "200": {
            description: "Server is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    environment: { type: "string", example: "development" },
                    timestamp: {
                      type: "string",
                      format: "date-time",
                      example: "2026-08-10T22:00:00.000Z",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/waitlist": {
      post: {
        tags: ["Waitlist"],
        summary: "Join the waitlist",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateWaitlistInput" },
            },
          },
        },
        responses: {
          "201": {
            description: "Joined waitlist",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ServiceResponse" },
              },
            },
          },
          "409": {
            description: "Email already on waitlist",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/waitlist/jzI27AUJTCKU": {
      get: {
        tags: ["Waitlist"],
        summary: "List waitlist entries (obscured admin path)",
        responses: {
          "200": {
            description: "Waitlist entries",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ServiceResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/links": {
      get: {
        tags: ["Links"],
        summary: "List my links",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          "200": {
            description: "Links ordered by displayOrder",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ServiceResponse" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      post: {
        tags: ["Links"],
        summary: "Create a link",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateLinkInput" },
            },
          },
        },
        responses: {
          "201": {
            description: "Link created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ServiceResponse" },
              },
            },
          },
          "409": {
            description: "Duplicate URL for this profile",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/links/reorder/all": {
      patch: {
        tags: ["Links"],
        summary: "Reorder links",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ReorderLinksInput" },
            },
          },
        },
        responses: {
          "200": {
            description: "Links reordered",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ServiceResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/links/{id}": {
      get: {
        tags: ["Links"],
        summary: "Get link by id",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Link found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ServiceResponse" },
              },
            },
          },
          "404": {
            description: "Not found or not owned",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      patch: {
        tags: ["Links"],
        summary: "Update a link",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateLinkInput" },
            },
          },
        },
        responses: {
          "200": {
            description: "Link updated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ServiceResponse" },
              },
            },
          },
        },
      },
      delete: {
        tags: ["Links"],
        summary: "Delete a link",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Link deleted",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ServiceResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/links/{id}/icon": {
      patch: {
        tags: ["Links"],
        summary: "Upload link icon",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["icon"],
                properties: {
                  icon: { type: "string", format: "binary" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Icon updated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ServiceResponse" },
              },
            },
          },
        },
      },
    },
  },
};

export const setupSwagger = (app: Express) => {
  app.use(
    "/api/v1/docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerDocument, {
      customCss: ".swagger-ui .topbar { display: none }",
      customSiteTitle: "Abio API Documentation",
      swaggerOptions: {
        persistAuthorization: true,
      },
    })
  );
};
