import z from "zod";

export const updateProfileSchema = z.object({
  body: z
    .object({
    })
    .partial(),
});

export type TUpdateProfile = z.infer<typeof updateProfileSchema.shape.body>;


