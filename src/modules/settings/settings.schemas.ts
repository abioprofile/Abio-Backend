import z from "zod";

export const updatePrivacySchema = z.object({
  body: z.object({
    visibility: z.enum(["public", "private"], {
      required_error: "Visibility is required",
    }),
  }),
});

export const updateNotificationsSchema = z.object({
  body: z.object({
    emailOnLinkTap: z.boolean({
      required_error: "emailOnLinkTap is required",
    }),
  }),
});

export type TUpdatePrivacy = z.infer<typeof updatePrivacySchema.shape.body>;
export type TUpdateNotifications = z.infer<
  typeof updateNotificationsSchema.shape.body
>;
