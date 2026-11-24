import {
  bearerSecurity,
  errorResponseContent,
  pageLimitParams,
  serviceResponseContent,
  uuidPath,
} from "./helpers";

const ADMIN_TAG = "Admin — Gift Accounts";

export const giftAccountsTags = [
  {
    name: ADMIN_TAG,
    description:
      "[Admin/Moderator] Create accounts for recipients, build their profile, links and theme, then hand them over with a one-time claim link (emailed and/or printed as a QR code). The link opens the main site's reset-password page (`POST /api/v1/auth/reset-password` accepts the claim token); after setting a password the recipient verifies their email and signs in. Edits are only allowed while the account is unclaimed, and every action is written to the admin audit log.",
  },
];

const json = (ref: string) => ({
  required: true,
  content: { "application/json": { schema: { $ref: `#/components/schemas/${ref}` } } },
});

const multipart = (field: string) => ({
  required: true,
  content: {
    "multipart/form-data": {
      schema: {
        type: "object",
        required: [field],
        properties: { [field]: { type: "string", format: "binary" } },
      },
    },
  },
});

const userIdParam = uuidPath("userId", "Gift account user id");
const linkIdParam = uuidPath("linkId", "Link id (must belong to this gift account)");

const staffErrors = {
  "401": { description: "Unauthenticated", content: errorResponseContent },
  "403": { description: "Not staff", content: errorResponseContent },
};

const editErrors = {
  ...staffErrors,
  "400": { description: "Validation error", content: errorResponseContent },
  "404": { description: "Not a gift account", content: errorResponseContent },
  "409": { description: "Account already claimed — staff can no longer edit", content: errorResponseContent },
};

const ok = (description: string) => ({
  "200": { description, content: serviceResponseContent },
});

export const giftAccountsSchemas = {
  CreateGiftAccountInput: {
    type: "object",
    required: ["name", "username", "email"],
    additionalProperties: false,
    properties: {
      name: { type: "string", maxLength: 100, example: "Ada Lovelace" },
      username: {
        type: "string",
        minLength: 3,
        maxLength: 30,
        pattern: "^[a-zA-Z0-9_-]+$",
        description: "Reserved names that clash with site pages (e.g. `dashboard`, `store`, `admin`) are rejected.",
        example: "ada",
      },
      email: {
        type: "string",
        format: "email",
        description: "Recipient email. Must not belong to an existing account (409).",
        example: "ada@example.com",
      },
      sendEmail: {
        type: "boolean",
        default: false,
        description: "Email the claim link now. Usually left off: build the page first, then send it with `POST …/claim-link`.",
      },
    },
  },
  IssueClaimLinkInput: {
    type: "object",
    additionalProperties: false,
    properties: {
      email: {
        type: "string",
        format: "email",
        description: "Set or replace the recipient email before sending.",
      },
      sendEmail: { type: "boolean", default: true },
    },
  },
  GiftAccountClaimLink: {
    type: "object",
    description:
      "Returned once. The raw token is never stored; issuing a new link invalidates the previous one.",
    properties: {
      claimUrl: { type: "string", format: "uri", example: "https://abio.site/auth/reset-password/3f…" },
      qrCodeDataUrl: {
        type: "string",
        description: "PNG data URL of `claimUrl`, ready to print on the card.",
        example: "data:image/png;base64,iVBORw0KGgo…",
      },
      expiresAt: { type: "string", format: "date-time" },
      emailStatus: { type: "string", enum: ["sent", "failed", "skipped"] },
      emailError: { type: "string", nullable: true },
    },
  },
  GiftAccountSummary: {
    type: "object",
    properties: {
      userId: { type: "string", format: "uuid" },
      name: { type: "string" },
      email: { type: "string", format: "email" },
      username: { type: "string", nullable: true },
      avatarUrl: { type: "string", nullable: true },
      isPublic: { type: "boolean" },
      active: { type: "boolean" },
      isEmailVerified: { type: "boolean" },
      status: { type: "string", enum: ["unclaimed", "claimed"] },
      claimedAt: { type: "string", format: "date-time", nullable: true },
      claimLinkExpiresAt: { type: "string", format: "date-time", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      createdBy: {
        type: "object",
        properties: { id: { type: "string", format: "uuid" }, name: { type: "string" } },
      },
    },
  },
};

export const giftAccountsPaths = {
  "/api/v1/admin/gift-accounts": {
    get: {
      tags: [ADMIN_TAG],
      summary: "List gift accounts",
      security: bearerSecurity,
      parameters: [
        ...pageLimitParams,
        {
          name: "q",
          in: "query",
          required: false,
          schema: { type: "string" },
          description: "Search name, email or username",
        },
        {
          name: "status",
          in: "query",
          required: false,
          schema: { type: "string", enum: ["unclaimed", "claimed"] },
        },
      ],
      responses: {
        ...ok("`{ accounts: GiftAccountSummary[], pagination }`"),
        ...staffErrors,
      },
    },
    post: {
      tags: [ADMIN_TAG],
      summary: "Create a gift account",
      description:
        "Creates a regular user with a random password nobody knows, a profile with the given username, and a 30-day one-time claim link. Nobody can sign in until the recipient claims it.",
      security: bearerSecurity,
      requestBody: json("CreateGiftAccountInput"),
      responses: {
        "201": {
          description: "`{ account: GiftAccountSummary, claim: GiftAccountClaimLink }`",
          content: serviceResponseContent,
        },
        "400": { description: "Validation error", content: errorResponseContent },
        "409": { description: "Email or username already in use", content: errorResponseContent },
        ...staffErrors,
      },
    },
  },
  "/api/v1/admin/gift-accounts/{userId}": {
    get: {
      tags: [ADMIN_TAG],
      summary: "Get a gift account with its profile, links and display settings",
      security: bearerSecurity,
      parameters: [userIdParam],
      responses: {
        ...ok("GiftAccountSummary plus `profile`"),
        "404": { description: "Not a gift account", content: errorResponseContent },
        ...staffErrors,
      },
    },
    delete: {
      tags: [ADMIN_TAG],
      summary: "Delete an unclaimed gift account",
      description:
        "Removes the user with their profile, links and theme. Claimed accounts belong to their owner and return 409.",
      security: bearerSecurity,
      parameters: [userIdParam],
      responses: {
        ...ok("Deleted"),
        "404": { description: "Not a gift account", content: errorResponseContent },
        "409": { description: "Already claimed", content: errorResponseContent },
        ...staffErrors,
      },
    },
  },
  "/api/v1/admin/gift-accounts/{userId}/claim-link": {
    post: {
      tags: [ADMIN_TAG],
      summary: "Issue a new claim link (email and/or QR)",
      description: "Invalidates any previous link for this account.",
      security: bearerSecurity,
      parameters: [userIdParam],
      requestBody: { ...json("IssueClaimLinkInput"), required: false },
      responses: {
        "201": { description: "GiftAccountClaimLink", content: serviceResponseContent },
        ...editErrors,
      },
    },
  },
  "/api/v1/admin/gift-accounts/{userId}/profile": {
    patch: {
      tags: [ADMIN_TAG],
      summary: "Update the gift account profile",
      description: "Same body and rules as `PATCH /api/v1/user/profile`.",
      security: bearerSecurity,
      parameters: [userIdParam],
      requestBody: json("UpdateProfileInput"),
      responses: { ...ok("Updated profile"), ...editErrors },
    },
  },
  "/api/v1/admin/gift-accounts/{userId}/profile/avatar": {
    patch: {
      tags: [ADMIN_TAG],
      summary: "Upload the gift account avatar",
      security: bearerSecurity,
      parameters: [userIdParam],
      requestBody: multipart("avatar"),
      responses: { ...ok("Updated profile"), ...editErrors },
    },
    delete: {
      tags: [ADMIN_TAG],
      summary: "Remove the gift account avatar",
      security: bearerSecurity,
      parameters: [userIdParam],
      responses: { ...ok("Avatar removed"), ...editErrors },
    },
  },
  "/api/v1/admin/gift-accounts/{userId}/preferences": {
    get: {
      tags: [ADMIN_TAG],
      summary: "Get theme / display preferences",
      security: bearerSecurity,
      parameters: [userIdParam],
      responses: { ...ok("Display preferences"), ...editErrors },
    },
    put: {
      tags: [ADMIN_TAG],
      summary: "Update theme / display preferences",
      description: "Same body and rules as `PUT /api/v1/user/preferences`.",
      security: bearerSecurity,
      parameters: [userIdParam],
      requestBody: json("UpdatePreferencesInput"),
      responses: { ...ok("Updated preferences"), ...editErrors },
    },
  },
  "/api/v1/admin/gift-accounts/{userId}/preferences/wallpaper/image": {
    post: {
      tags: [ADMIN_TAG],
      summary: "Upload a wallpaper image",
      description: "Returns `{ url }` to use in `wallpaper_config.image`.",
      security: bearerSecurity,
      parameters: [userIdParam],
      requestBody: multipart("image"),
      responses: { ...ok("Uploaded image URL"), ...editErrors },
    },
  },
  "/api/v1/admin/gift-accounts/{userId}/links": {
    get: {
      tags: [ADMIN_TAG],
      summary: "List the gift account links",
      security: bearerSecurity,
      parameters: [userIdParam],
      responses: { ...ok("Links in display order"), ...editErrors },
    },
    post: {
      tags: [ADMIN_TAG],
      summary: "Add a link",
      description: "Same body and rules as `POST /api/v1/links`.",
      security: bearerSecurity,
      parameters: [userIdParam],
      requestBody: json("CreateLinkInput"),
      responses: {
        "201": { description: "Created link", content: serviceResponseContent },
        ...editErrors,
      },
    },
  },
  "/api/v1/admin/gift-accounts/{userId}/links/reorder/all": {
    patch: {
      tags: [ADMIN_TAG],
      summary: "Reorder links",
      security: bearerSecurity,
      parameters: [userIdParam],
      requestBody: json("ReorderLinksInput"),
      responses: { ...ok("Reordered links"), ...editErrors },
    },
  },
  "/api/v1/admin/gift-accounts/{userId}/links/{linkId}": {
    patch: {
      tags: [ADMIN_TAG],
      summary: "Update a link",
      security: bearerSecurity,
      parameters: [userIdParam, linkIdParam],
      requestBody: json("UpdateLinkInput"),
      responses: { ...ok("Updated link"), ...editErrors },
    },
    delete: {
      tags: [ADMIN_TAG],
      summary: "Delete a link",
      security: bearerSecurity,
      parameters: [userIdParam, linkIdParam],
      responses: { ...ok("Link deleted"), ...editErrors },
    },
  },
  "/api/v1/admin/gift-accounts/{userId}/links/{linkId}/icon": {
    patch: {
      tags: [ADMIN_TAG],
      summary: "Upload a link icon",
      security: bearerSecurity,
      parameters: [userIdParam, linkIdParam],
      requestBody: multipart("icon"),
      responses: { ...ok("Updated link"), ...editErrors },
    },
  },
};
