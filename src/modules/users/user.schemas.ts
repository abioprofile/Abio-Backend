import z from "zod";
import { zPhone } from "@/shared/utils/zod/phone";

export const updateUserSchema = z.object({
  body: z
    .object({
      name: z.string().optional(),
      email: z.string().email().optional(),
      phoneNumber: zPhone.optional(),
    })
    .partial(),
});

export const getUserSchema = z.object({
  params: z.object({
    id: z.string({ required_error: "User ID is required" }),
  }),
});

export const deleteAccountSchema = z.object({
  body: z.object({
    password: z.string({
      required_error: "Password is required to delete your account",
    }),
  }),
});

export const updateEmailSchema = z.object({
  body: z.object({
    email: z.string().email(),
  }),
});

export type TUpdateUser = z.infer<typeof updateUserSchema.shape.body>;
export type TGetUser = z.infer<typeof getUserSchema.shape.params>;
export type TDeleteAccount = z.infer<typeof deleteAccountSchema.shape.body>;
export type TUpdateEmail = z.infer<typeof updateEmailSchema.shape.body>;
