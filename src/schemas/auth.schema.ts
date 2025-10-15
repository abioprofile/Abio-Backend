import z from "zod";
import { PASSWORD_COMPLEXITY_REGEX } from "@/utils/constants";
import { token } from "morgan";

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
      token: z.string({
        required_error: "Token is required",
      }).min(6, "Token must be 6 characters").max(6, "Token must be 6 characters"),
      password: z
        .string({
          required_error: "Password is required",
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



export type TLogin = z.infer<typeof loginSchema.shape.body>;
export type TForgotPassword = z.infer<typeof forgotPasswordSchema.shape.body>;
export type TResetPassword = z.infer<typeof resetPasswordSchema.shape.body>;
export type TUpdatePassword = z.infer<typeof updatePasswordSchema.shape.body>;
