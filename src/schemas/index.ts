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
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updatePasswordSchema,
  verifyEmailSchema,
  resendVerificationEmailSchema,
  verify2FaSchema,
} from "@/modules/auth/auth.schemas";
export type {
  TSignup,
  TLogin,
  TForgotPassword,
  TResetPassword,
  TUpdatePassword,
  TVerifyEmail,
  TResendVerificationEmail,
  TVerify2Fa,
} from "@/modules/auth/auth.schemas";

export { updateUserSchema } from "@/modules/users/user.schemas";
export type { TUpdateUser } from "@/modules/users/user.schemas";

export {
  updateProfileSchema,
  checkUsernameSchema,
} from "@/modules/profiles/profile.schemas";
export type {
  TUpdateProfile,
  TCheckUsername,
} from "@/modules/profiles/profile.schemas";
