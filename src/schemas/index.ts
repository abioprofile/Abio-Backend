import z from "zod";

export const UUIDSchema = z.object({
  params: z.object({
    id: z
      .string({ required_error: "Object ID is required" })
      .uuid("Invalid UUID"),
  }),
});

export function clean<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined)
  ) as Partial<T>;
}

export type TUUI = z.infer<typeof UUIDSchema.shape.params>;

export {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updatePasswordSchema,
  verifyEmailSchema,
  resendVerificationEmailSchema,
} from "./auth.schema";
export type {
  TLogin,
  TForgotPassword,
  TResetPassword,
  TUpdatePassword,
  TVerifyEmail,
  TResendVerificationEmail,
} from "./auth.schema";

export { createUserSchema, updateUserSchema } from "./user.schema";

export type { TCreateUser, TUpdateUser } from "./user.schema";

export { updateProfileSchema } from "./profile.schema";
export type { TUpdateProfile } from "./profile.schema";

export { createWaitlistSchema } from "./waitlist.schema";
export type { TCreateWaitlist } from "./waitlist.schema";
