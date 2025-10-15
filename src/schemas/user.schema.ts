import z from "zod";
import { PASSWORD_COMPLEXITY_REGEX } from "@/utils/constants";
import { zPhone } from "@/utils/zod/phone";

export const createUserSchema = z.object({
  body: z
    .object({
      firstName: z.string({ required_error: "First Name is required" }),
      lastName: z.string({ required_error: "Last Name is required" }),
      email: z
        .string({ required_error: "Email is required" })
        .email("Invalid email address"),
      password: z
        .string({ required_error: "Password is required" })
        .min(8, "Password must be at least 8 characters long")
        .regex(
          PASSWORD_COMPLEXITY_REGEX,
          "Password must include a letter, a number, and a special character"
        ),
      passwordConfirm: z.string({
        required_error: "Password Confirm is required",
      }),
      phoneNumber: zPhone.optional(),
      profile: z.object({
        
      }),
    })
    .refine((data) => data.password === data.passwordConfirm, {
      path: ["passwordConfirm"],
      message: "Passwords do not match",
    }),
});

export const updateUserSchema = z.object({
  body: z
    .object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
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

export type TCreateUser = z.infer<typeof createUserSchema.shape.body>;
export type TUpdateUser = z.infer<typeof updateUserSchema.shape.body>;
export type TGetUser = z.infer<typeof getUserSchema.shape.params>;
