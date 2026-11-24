import z from "zod";

/**
 * Usernames that would collide with main-site pages (abio.site/<username>)
 * or are misleading. Checked case-insensitively for gift accounts.
 */
export const RESERVED_USERNAMES = new Set([
  "abio", "about", "account", "admin", "administrator", "api", "app", "assets",
  "auth", "billing", "blog", "cart", "checkout", "claim", "contact",
  "contact-us", "dashboard", "docs", "help", "home", "icons", "images",
  "login", "logout", "me", "moderator", "null", "onboarding", "orders",
  "pricing", "privacy", "profile", "register", "reset-password", "root",
  "settings", "sign-in", "sign-up", "signin", "signup", "staff", "static",
  "store", "support", "system", "template", "terms", "themes", "undefined",
  "user", "users", "www",
]);

export const isReservedUsername = (username: string) =>
  RESERVED_USERNAMES.has(username.trim().toLowerCase());

const usernameField = z
  .string({ required_error: "Username is required" })
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(30, "Username must be 30 characters or less")
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "Username can only contain letters, numbers, hyphens and underscores"
  )
  .refine((value) => !isReservedUsername(value), {
    message: "This username is reserved. Please choose another.",
  });

const emailField = z
  .string({ required_error: "Email is required" })
  .trim()
  .toLowerCase()
  .email("Invalid email address")
  .max(254, "Email is too long");

const userIdParams = z.object({
  userId: z.string().uuid("Invalid user id"),
});

/** POST /api/v1/admin/gift-accounts */
export const createGiftAccountSchema = z.object({
  body: z
    .object({
      name: z
        .string({ required_error: "Name is required" })
        .trim()
        .min(1, "Name is required")
        .max(100, "Name must be 100 characters or less"),
      username: usernameField,
      /** Recipient email; the claim link is sent here. */
      email: emailField,
      /**
       * Email the claim link right away. Off by default: staff usually build
       * the page first and send the link from the handover step.
       */
      sendEmail: z.boolean().default(false),
    })
    .strict(),
});

/** GET /api/v1/admin/gift-accounts */
export const listGiftAccountsSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    q: z.string().trim().min(1).max(100).optional(),
    status: z.enum(["unclaimed", "claimed"]).optional(),
  }),
});

export const giftAccountParamsSchema = z.object({
  params: userIdParams,
});

/** POST /api/v1/admin/gift-accounts/:userId/claim-link */
export const issueClaimLinkSchema = z.object({
  params: userIdParams,
  body: z
    .object({
      /** Set or replace the recipient email before sending the link. */
      email: emailField.optional(),
      sendEmail: z.boolean().default(true),
    })
    .strict()
    .default({}),
});

export const giftLinkParamsSchema = z.object({
  params: userIdParams.extend({
    linkId: z.string().uuid("Invalid link id"),
  }),
});

export type TCreateGiftAccount = z.infer<
  typeof createGiftAccountSchema.shape.body
>;
export type TListGiftAccountsQuery = z.infer<
  typeof listGiftAccountsSchema.shape.query
>;
export type TIssueClaimLink = z.infer<typeof issueClaimLinkSchema.shape.body>;
