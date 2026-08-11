import z from "zod";
import { PASSWORD_COMPLEXITY_REGEX } from "@/shared/utils/constants";

export const signupSchema = z.object({
  body: z
    .object({
      name: z.string({ required_error: "Name is required" }),
      email: z
        .string({ required_error: "Email is required" })
        .email("Invalid email address"),
      password: z
        .string({ required_error: "Password is required" })
        .min(8, "Password must be at least 8 characters long")
        .regex(
          process.env.NODE_ENV == "production"
            ? PASSWORD_COMPLEXITY_REGEX
            : /.+/,
          "Password must include a letter, a number, and a special character"
        ),
      passwordConfirm: z.string({
        required_error: "Password Confirm is required",
      }),
    })
    .refine((data) => data.password === data.passwordConfirm, {
      path: ["passwordConfirm"],
      message: "Passwords do not match",
    }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z
      .string({
        required_error: "Email is required",
      })
      .email("Invalid email address"),
    password: z.string({
      required_error: "Password is required",
    }),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z
      .string({
        required_error: "Email is required",
      })
      .email("Invalid email address"),
  }),
});

export const resetPasswordSchema = z.object({
  body: z
    .object({
      token: z
        .string({
          required_error: "Token is required",
        })
        .min(6, "Token must be 6 characters")
        .max(6, "Token must be 6 characters"),
      password: z
        .string({
          required_error: "Password is required",
        })
        .min(8, "Password must be at least 8 characters")
        .regex(
          process.env.NODE_ENV == "production"
            ? PASSWORD_COMPLEXITY_REGEX
            : /.+/,
          "Password must include a letter, a number, and a special character"
        ),
      passwordConfirm: z.string({
        required_error: "Password confirmation is required",
      }),
    })
    .refine((data) => data.password === data.passwordConfirm, {
      message: "Passwords do not match",
      path: ["passwordConfirm"],
    }),
});

export const updatePasswordSchema = z.object({
  body: z
    .object({
      passwordCurrent: z.string({
        required_error: "Current password is required",
      }),
      password: z
        .string({
          required_error: "New password is required",
        })
        .min(8, "Password must be at least 8 characters")
        .regex(
          PASSWORD_COMPLEXITY_REGEX,
          "Password must include a letter, a number, and a special character"
        ),
      passwordConfirm: z.string({
        required_error: "Password confirmation is required",
      }),
    })
    .refine((data) => data.password === data.passwordConfirm, {
      message: "Passwords do not match",
      path: ["passwordConfirm"],
    }),
});

export const verifyEmailSchema = z.object({
  body: z.object({
    token: z
      .string({
        required_error: "Verification token is required",
      })
      .min(6, "Token must be 6 characters")
      .max(6, "Token must be 6 characters"),
  }),
});

export const resendVerificationEmailSchema = z.object({
  body: z.object({
    email: z
      .string({
        required_error: "Email is required",
      })
      .email("Invalid email address"),
  }),
});

export const verify2FaSchema = z.object({
  body: z.object({
    token: z.string().regex(/^\d{6}$/),
    email: z.string().email(),
  }),
});

export type TSignup = z.infer<typeof signupSchema.shape.body>;
export type TLogin = z.infer<typeof loginSchema.shape.body>;
export type TForgotPassword = z.infer<typeof forgotPasswordSchema.shape.body>;
export type TResetPassword = z.infer<typeof resetPasswordSchema.shape.body>;
export type TUpdatePassword = z.infer<typeof updatePasswordSchema.shape.body>;
export type TVerifyEmail = z.infer<typeof verifyEmailSchema.shape.body>;
export type TResendVerificationEmail = z.infer<
  typeof resendVerificationEmailSchema.shape.body
>;
export type TVerify2Fa = z.infer<typeof verify2FaSchema.shape.body>;
