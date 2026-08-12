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

## Passwords
In production, passwords must be at least 8 characters and include a letter, a number, and a special character (\`@$!%*#?&\`). Example: \`Passw0rd!\`.
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
    { name: "Users", description: "Account (me, delete, update email)" },
    { name: "Profiles", description: "Public/private profile and preferences" },
    { name: "Links", description: "Link CRUD, reorder, click tracking" },
    { name: "Themes", description: "Display themes" },
    { name: "Waitlist", description: "Waitlist signup" },
    { name: "Public", description: "Unauthenticated public endpoints (click tracking)" },
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

      // ── Auth ──────────────────────────────────────────────
      LoginInput: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: {
            type: "string",
            format: "email",
            example: "ada@example.com",
          },
          password: {
            type: "string",
            format: "password",
            example: "Passw0rd!",
          },
        },
        example: {
          email: "ada@example.com",
          password: "Passw0rd!",
        },
      },
      ForgotPasswordInput: {
        type: "object",
        required: ["email"],
        properties: {
          email: {
            type: "string",
            format: "email",
            example: "ada@example.com",
          },
        },
        example: { email: "ada@example.com" },
      },
      ResetPasswordInput: {
        type: "object",
        required: ["token", "password", "passwordConfirm"],
        properties: {
          token: {
            type: "string",
            minLength: 32,
            maxLength: 128,
            example: "a1b2c3d4e5f6789012345678901234567890abcd",
            description:
              "Raw reset token from the link (${CLIENT_URL}/auth/reset-password/<token>). Not an OTP.",
          },
          password: {
            type: "string",
            format: "password",
            minLength: 8,
            example: "Passw0rd!",
          },
          passwordConfirm: {
            type: "string",
            format: "password",
            example: "Passw0rd!",
          },
        },
        example: {
          token: "a1b2c3d4e5f6789012345678901234567890abcd",
          password: "Passw0rd!",
          passwordConfirm: "Passw0rd!",
        },
      },
      UpdatePasswordInput: {
        type: "object",
        required: ["passwordCurrent", "password", "passwordConfirm"],
        properties: {
          passwordCurrent: {
            type: "string",
            format: "password",
            example: "OldPass1!",
          },
          password: {
            type: "string",
            format: "password",
            minLength: 8,
            example: "Passw0rd!",
            description:
              "Must include a letter, a number, and a special character",
          },
          passwordConfirm: {
            type: "string",
            format: "password",
            example: "Passw0rd!",
          },
        },
        example: {
          passwordCurrent: "OldPass1!",
          password: "Passw0rd!",
          passwordConfirm: "Passw0rd!",
        },
      },
      VerifyEmailInput: {
        type: "object",
        required: ["token"],
        properties: {
          token: {
            type: "string",
            minLength: 32,
            maxLength: 128,
            example: "a1b2c3d4e5f6...",
            description:
              "Raw email verification token from the link (${CLIENT_URL}/auth/<token>). Not an OTP.",
          },
        },
        example: { token: "a1b2c3d4e5f6789012345678901234567890abcd" },
      },
      RefreshTokenInput: {
        type: "object",
        properties: {
          refreshToken: {
            type: "string",
            description:
              "Opaque refresh token. Optional if the httpOnly `refresh` cookie is present.",
          },
        },
        example: { refreshToken: "opaque-refresh-token-hex" },
      },
      ResendVerificationEmailInput: {
        type: "object",
        required: ["email"],
        properties: {
          email: {
            type: "string",
            format: "email",
            example: "ada@example.com",
          },
        },
        example: { email: "ada@example.com" },
      },
      Verify2FaInput: {
        type: "object",
        required: ["email", "token"],
        properties: {
          email: {
            type: "string",
            format: "email",
            example: "ada@example.com",
          },
          token: {
            type: "string",
            pattern: "^\\d{6}$",
            example: "123456",
            description: "6-digit TOTP code from authenticator app",
          },
        },
        example: {
          email: "ada@example.com",
          token: "123456",
        },
      },

      // ── Users ─────────────────────────────────────────────
      SignupInput: {
        type: "object",
        required: ["name", "email", "password", "passwordConfirm"],
        properties: {
          name: { type: "string", example: "Ada Lovelace" },
          email: {
            type: "string",
            format: "email",
            example: "ada@example.com",
          },
          password: {
            type: "string",
            format: "password",
            minLength: 8,
            example: "Passw0rd!",
          },
          passwordConfirm: {
            type: "string",
            format: "password",
            example: "Passw0rd!",
          },
        },
        example: {
          name: "Ada Lovelace",
          email: "ada@example.com",
          password: "Passw0rd!",
          passwordConfirm: "Passw0rd!",
        },
      },
      DeleteAccountInput: {
        type: "object",
        required: ["password"],
        properties: {
          password: {
            type: "string",
            format: "password",
            example: "Passw0rd!",
            description: "Current account password",
          },
        },
        example: { password: "Passw0rd!" },
      },
      UpdateEmailInput: {
        type: "object",
        required: ["email"],
        properties: {
          email: {
            type: "string",
            format: "email",
            example: "new@example.com",
          },
        },
        example: { email: "new@example.com" },
      },

      // ── Profiles ──────────────────────────────────────────
      UpdateProfileInput: {
        type: "object",
        properties: {
          username: {
            type: "string",
            minLength: 3,
            maxLength: 30,
            example: "ada_lovelace",
            description: "Letters, numbers, hyphens, underscores only",
          },
          displayName: {
            type: "string",
            maxLength: 100,
            example: "Ada Lovelace",
          },
          bio: {
            type: "string",
            maxLength: 500,
            example: "Mathematician & first programmer",
          },
          location: {
            type: "string",
            maxLength: 100,
            example: "London",
          },
          goals: {
            type: "array",
            maxItems: 10,
            items: { type: "string", maxLength: 200 },
            example: ["Ship Abio", "Write more"],
          },
          avatarUrl: {
            type: "string",
            format: "uri",
            example: "https://cdn.example.com/avatars/ada.png",
          },
          isPublic: { type: "boolean", example: true },
        },
        example: {
          username: "ada_lovelace",
          displayName: "Ada Lovelace",
          bio: "Mathematician & first programmer",
          location: "London",
          goals: ["Ship Abio"],
          isPublic: true,
        },
      },

      // ── Preferences ───────────────────────────────────────
      FontConfigInput: {
        type: "object",
        required: ["name"],
        properties: {
          name: {
            type: "string",
            example: "Inter",
            description: "Letters, numbers, hyphens only",
          },
          fillColor: { type: "string", example: "#111111" },
          strokeColor: { type: "string", example: "#000000" },
        },
        example: {
          name: "Inter",
          fillColor: "#111111",
        },
      },
      CornerConfigInput: {
        type: "object",
        required: ["type"],
        properties: {
          type: {
            type: "string",
            enum: ["sharp", "curved", "round"],
            example: "round",
          },
          fillColor: { type: "string", example: "#ffffff" },
          strokeColor: { type: "string", example: "#e5e5e5" },
          opacity: {
            type: "number",
            minimum: 0,
            maximum: 1,
            example: 0.9,
          },
          shadowSize: { type: "string", example: "8px" },
          shadowColor: { type: "string", example: "rgba(0,0,0,0.15)" },
        },
        example: {
          type: "round",
          opacity: 0.9,
        },
      },
      WallpaperConfigInput: {
        type: "object",
        required: ["type"],
        properties: {
          type: {
            type: "string",
            example: "solid",
            description: 'e.g. "solid", "image", "gradient"',
          },
          image: {
            type: "string",
            format: "uri",
            example: "https://cdn.example.com/bg.jpg",
          },
          backgroundColor: {
            oneOf: [
              { type: "string", example: "#ffffff" },
              {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    color: { type: "string", example: "#111111" },
                    amount: {
                      type: "number",
                      minimum: 0,
                      maximum: 1,
                      example: 0.5,
                    },
                  },
                },
              },
            ],
          },
        },
        example: {
          type: "solid",
          backgroundColor: "#ffffff",
        },
      },
      UpdatePreferencesInput: {
        type: "object",
        required: ["font_config", "wallpaper_config", "corner_config"],
        properties: {
          font_config: { $ref: "#/components/schemas/FontConfigInput" },
          wallpaper_config: {
            $ref: "#/components/schemas/WallpaperConfigInput",
          },
          corner_config: { $ref: "#/components/schemas/CornerConfigInput" },
        },
        example: {
          font_config: { name: "Inter", fillColor: "#111111" },
          wallpaper_config: { type: "solid", backgroundColor: "#ffffff" },
          corner_config: { type: "round" },
        },
      },

      // ── Links ─────────────────────────────────────────────
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
          isVisible: { type: "boolean", default: true, example: true },
        },
        example: {
          title: "GitHub",
          url: "https://github.com/abio",
          isVisible: true,
        },
      },
      UpdateLinkInput: {
        type: "object",
        properties: {
          title: { type: "string", example: "GitHub Profile" },
          url: { type: "string", example: "https://github.com/abio" },
          platform: { type: "string", example: "GITHUB" },
          isVisible: { type: "boolean", example: true },
          displayOrder: { type: "integer", minimum: 0, example: 0 },
        },
        example: {
          title: "GitHub Profile",
          isVisible: true,
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
                id: {
                  type: "string",
                  format: "uuid",
                  example: "550e8400-e29b-41d4-a716-446655440000",
                },
                displayOrder: { type: "integer", minimum: 0, example: 0 },
              },
            },
          },
        },
        example: {
          links: [
            {
              id: "550e8400-e29b-41d4-a716-446655440000",
              displayOrder: 0,
            },
            {
              id: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
              displayOrder: 1,
            },
          ],
        },
      },

      // ── Waitlist / Themes ─────────────────────────────────
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
        example: {
          name: "Ada Lovelace",
          email: "ada@example.com",
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
      CreateThemeInput: {
        type: "object",
        required: ["name", "font_config", "corner_config", "wallpaper_config"],
        properties: {
          name: { type: "string", example: "Midnight" },
          font_config: { $ref: "#/components/schemas/FontConfigInput" },
          corner_config: { $ref: "#/components/schemas/CornerConfigInput" },
          wallpaper_config: {
            $ref: "#/components/schemas/WallpaperConfigInput",
          },
        },
        example: {
          name: "Midnight",
          font_config: { name: "Inter", fillColor: "#111111" },
          corner_config: { type: "round" },
          wallpaper_config: { type: "solid", backgroundColor: "#0a0a0a" },
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

    // ── Auth ────────────────────────────────────────────────
    "/api/v1/auth/signup": {
      post: {
        tags: ["Auth"],
        summary: "Sign up",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SignupInput" },
            },
          },
        },
        responses: {
          "201": {
            description:
              "User created — check email to verify. Body: { success, message, data: null, statusCode }",
          },
          "409": { description: "Email already exists" },
        },
      },
    },
    "/api/v1/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in with email and password",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginInput" },
            },
          },
        },
        responses: {
          "200": {
            description:
              "Logged in (sets access + refresh + logged_in cookies; body includes accessToken + refreshToken)",
          },
          "401": { description: "Incorrect email or password" },
          "403": { description: "Email not verified" },
          "429": { description: "Too many login attempts" },
        },
      },
    },
    "/api/v1/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Rotate refresh token and issue a new access token",
        description:
          "Send `refreshToken` in the body or the httpOnly `refresh` cookie. Old refresh token is invalidated (rotation).",
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RefreshTokenInput" },
            },
          },
        },
        responses: {
          "200": { description: "New access + refresh tokens" },
          "401": { description: "Invalid or expired refresh token" },
        },
      },
    },
    "/api/v1/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Log out (clears cookies, blacklists access JWT, revokes refresh)",
        description:
          "Optional: send Bearer/access cookie to blacklist the JWT, and refresh body/cookie to revoke the refresh row.",
        responses: {
          "200": { description: "Logged out" },
        },
      },
    },
    "/api/v1/auth/forgot-password": {
      post: {
        tags: ["Auth"],
        summary: "Request password reset email",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ForgotPasswordInput" },
            },
          },
        },
        responses: {
          "200": { description: "Reset link emailed" },
          "404": { description: "Unknown email" },
        },
      },
    },
    "/api/v1/auth/reset-password": {
      post: {
        tags: ["Auth"],
        summary: "Reset password with emailed link token",
        description:
          "Frontend route `/auth/reset-password/:token` extracts the token and POSTs it here with the new password.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ResetPasswordInput" },
            },
          },
        },
        responses: {
          "200": { description: "Password reset" },
          "400": { description: "Invalid or expired token" },
        },
      },
    },
    "/api/v1/auth/update-password": {
      patch: {
        tags: ["Auth"],
        summary: "Change password while authenticated",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdatePasswordInput" },
            },
          },
        },
        responses: {
          "200": { description: "Password updated" },
          "401": { description: "Wrong current password or unauthorized" },
        },
      },
    },
    "/api/v1/auth/verify-email": {
      post: {
        tags: ["Auth"],
        summary: "Verify email with link token",
        description:
          "Frontend route `/auth/:token` extracts the token and POSTs it here. On success, issues access + refresh and queues the welcome email.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/VerifyEmailInput" },
            },
          },
        },
        responses: {
          "200": {
            description: "Email verified + access/refresh tokens returned",
          },
          "400": { description: "Invalid or expired token" },
        },
      },
    },
    "/api/v1/auth/resend-verification-email": {
      post: {
        tags: ["Auth"],
        summary: "Resend email verification link",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ResendVerificationEmailInput",
              },
            },
          },
        },
        responses: {
          "200": { description: "Verification email sent" },
        },
      },
    },
    "/api/v1/auth/2fa/totp/activate": {
      get: {
        tags: ["Auth"],
        summary: "Activate TOTP 2FA",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          "200": { description: "OTP secret + QR code" },
        },
      },
    },
    "/api/v1/auth/2fa/totp/verify": {
      post: {
        tags: ["Auth"],
        summary: "Verify TOTP code and log in",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Verify2FaInput" },
            },
          },
        },
        responses: {
          "200": { description: "Logged in with JWT" },
        },
      },
    },

    // ── Waitlist ────────────────────────────────────────────
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

    // ── Users ───────────────────────────────────────────────
    "/api/v1/user": {
      get: {
        tags: ["Users"],
        summary: "Get logged-in user",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          "200": { description: "Current user" },
          "401": { description: "Unauthorized" },
        },
      },
      delete: {
        tags: ["Users"],
        summary: "Delete account",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/DeleteAccountInput" },
            },
          },
        },
        responses: {
          "200": { description: "Account deleted" },
          "401": { description: "Wrong password or unauthorized" },
        },
      },
    },
    "/api/v1/user/check-username": {
      get: {
        tags: ["Users"],
        summary: "Check username availability",
        parameters: [
          {
            name: "username",
            in: "query",
            required: true,
            schema: {
              type: "string",
              minLength: 3,
              maxLength: 30,
              example: "ada_lovelace",
            },
          },
        ],
        responses: {
          "200": { description: "{ isAvailable: boolean }" },
        },
      },
    },

    // ── Profiles ────────────────────────────────────────────
    "/api/v1/user/profile": {
      get: {
        tags: ["Profiles"],
        summary: "Get my profile",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: { "200": { description: "Profile" } },
      },
      patch: {
        tags: ["Profiles"],
        summary: "Update my profile",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateProfileInput" },
            },
          },
        },
        responses: { "200": { description: "Updated" } },
      },
    },
    "/api/v1/user/profile/email": {
      patch: {
        tags: ["Users"],
        summary: "Update account email (triggers re-verification)",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateEmailInput" },
            },
          },
        },
        responses: {
          "200": { description: "Verification email sent to new address" },
        },
      },
    },
    "/api/v1/user/profile/avatar": {
      patch: {
        tags: ["Profiles"],
        summary: "Upload profile avatar",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["avatar"],
                properties: {
                  avatar: {
                    type: "string",
                    format: "binary",
                    description: "Image file",
                  },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Avatar updated" } },
      },
    },
    "/api/v1/user/{username}": {
      get: {
        tags: ["Profiles"],
        summary: "Get public profile by username",
        parameters: [
          {
            name: "username",
            in: "path",
            required: true,
            schema: { type: "string", example: "ada_lovelace" },
          },
        ],
        responses: {
          "200": { description: "Public profile + visible links" },
          "404": { description: "Not found or private" },
        },
      },
    },

    // ── Preferences ─────────────────────────────────────────
    "/api/v1/user/preferences": {
      get: {
        tags: ["Profiles"],
        summary: "Get display preferences",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: { "200": { description: "Preferences" } },
      },
      put: {
        tags: ["Profiles"],
        summary: "Update all display preferences",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdatePreferencesInput" },
            },
          },
        },
        responses: { "200": { description: "Updated" } },
      },
    },
    "/api/v1/user/preferences/fonts": {
      put: {
        tags: ["Profiles"],
        summary: "Update font preferences",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/FontConfigInput" },
            },
          },
        },
        responses: { "200": { description: "Font preferences updated" } },
      },
    },
    "/api/v1/user/preferences/corners": {
      put: {
        tags: ["Profiles"],
        summary: "Update corner preferences",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CornerConfigInput" },
            },
          },
        },
        responses: { "200": { description: "Corner preferences updated" } },
      },
    },
    "/api/v1/user/preferences/background": {
      put: {
        tags: ["Profiles"],
        summary: "Update background / wallpaper preferences",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/WallpaperConfigInput" },
            },
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["type"],
                properties: {
                  type: {
                    type: "string",
                    example: "image",
                    description: 'Use "image" when uploading a file',
                  },
                  backgroundColor: { type: "string", example: "#ffffff" },
                  image: {
                    type: "string",
                    format: "binary",
                    description: "Wallpaper image file when type is image",
                  },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Background preferences updated" } },
      },
    },

    // ── Themes ──────────────────────────────────────────────
    "/api/v1/themes": {
      get: {
        tags: ["Themes"],
        summary: "List display themes",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          "200": {
            description: "Themes list",
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
        tags: ["Themes"],
        summary: "Create a display theme (admin)",
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateThemeInput" },
            },
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string", example: "Midnight" },
                  "wallpaper_config[image]": {
                    type: "string",
                    format: "binary",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Theme created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ServiceResponse" },
              },
            },
          },
          "403": {
            description: "Admin role required",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },

    // ── Links ───────────────────────────────────────────────
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

    // ── Public ──────────────────────────────────────────────
    "/api/v1/public/links/{id}/click": {
      post: {
        tags: ["Public"],
        summary: "Track a public link click",
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
            description: "Click tracked",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ServiceResponse" },
              },
            },
          },
          "404": {
            description: "Link not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
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
