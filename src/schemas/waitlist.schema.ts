import z from "zod";

export const createWaitlistSchema = z.object({
  body: z.object({
    name: z
      .string({
        required_error: "Name is required",
      })
      .min(1, "Name is required"),
    email: z
      .string({
        required_error: "Email is required",
      })
      .email("Invalid email address"),
  }),
});

export type TCreateWaitlist = z.infer<typeof createWaitlistSchema.shape.body>;
