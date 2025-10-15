import z from "zod";

export const createWaitlistSchema = z.object({
  body: z.object({
    email: z
      .string({
        required_error: "Email is required",
      })
      .email("Invalid email address"),
  }),
});

export type TCreateWaitlist = z.infer<typeof createWaitlistSchema.shape.body>;
