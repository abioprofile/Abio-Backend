import z from "zod";

export const trackProfileViewSchema = z.object({
  params: z.object({
    username: z.string().trim().min(1).max(64),
  }),
});
