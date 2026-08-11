import crypto from "crypto";
import jwt from "jsonwebtoken";
import QRCode from "qrcode";
import { User } from "@prisma/client";
import { StatusCodes } from "http-status-codes";
import { verify } from "@otplib/totp";
import { crypto as tCrypto } from "@otplib/plugin-crypto-node";
import { base32 } from "@otplib/plugin-base32-scure";
import { generateTOTP } from "@otplib/uri";

import env from "@/env";
import { prisma } from "@/shared/config/database";
import { ServiceResponse } from "@/shared/utils/serviceResponse";
import { AppError } from "@/shared/utils/appError";
import { NotFoundError, UnauthorizedError } from "@/shared/utils/errors";
import Email from "@/shared/utils/email";
import { generateUniqueId, generateRandomBase32 } from "@/shared/utils/uniqueId";
import { decrypt, encrypt } from "@/shared/utils/encrpyt";
import type { LoginResult, UserWithProfile } from "@/shared/types";
import {
  comparePassword,
  hashPassword,
  generateOTP,
} from "@/modules/users/user.service";
import type {
  TForgotPassword,
  TLogin,
  TResetPassword,
  TUpdatePassword,
} from "./auth.schemas";

export const signToken = (id: string): string => {
  const secret = env.JWT_SECRET;
  const expiresIn = env.JWT_EXPIRES_IN;
  return jwt.sign({ id }, secret, { expiresIn } as any);
};

export type LoginSuccess = {
  user: Record<string, unknown>;
  token: string;
};

export const login = async (credentials: TLogin): Promise<LoginSuccess> => {
  const user = await prisma.user.findUnique({
    where: { email: credentials.email },
    select: {
      id: true,
      name: true,
      email: true,
      active: true,
      password: true,
      isEmailVerified: true,
      createdAt: true,
      updatedAt: true,
      profile: true,
    },
  });

  if (
    !user ||
    !(await comparePassword(credentials.password, user.password))
  ) {
    throw new UnauthorizedError("Incorrect email or password");
  }

  if (!user.isEmailVerified) {
    throw new AppError(
      "Please verify your email address before logging in. Check your inbox for the verification code.",
      StatusCodes.FORBIDDEN
    );
  }

  const { password: _, ...userWithoutPassword } = user;
  const token = signToken(user.id);

  return {
    user: userWithoutPassword,
    token,
  };
};

export const forgotPassword = async (data: TForgotPassword): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (!user) {
    throw new AppError(
      "There is no user with that email address",
      StatusCodes.NOT_FOUND
    );
  }

  const resetToken = generateUniqueId(6);
  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: hashedToken,
      passwordResetExpires: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  try {
    await new Email({ ...user, profile: null }, resetToken).sendPasswordReset();
  } catch {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });
    throw new AppError(
      "There was an error sending the email. Try again later!",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export const resetPassword = async (data: TResetPassword): Promise<void> => {
  const hashedToken = crypto
    .createHash("sha256")
    .update(data.token)
    .digest("hex");

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: hashedToken,
      passwordResetExpires: {
        gt: new Date(),
      },
    },
  });

  if (!user) {
    throw new AppError("Token is invalid or has expired", StatusCodes.BAD_REQUEST);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await hashPassword(data.password),
      passwordResetToken: null,
      passwordResetExpires: null,
      passwordChangedAt: new Date(),
    },
  });
};

export const updatePassword = async (
  userId: string,
  data: TUpdatePassword
): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      password: true,
    },
  });

  if (!user) {
    throw new NotFoundError("User");
  }

  if (!(await comparePassword(data.passwordCurrent, user.password))) {
    throw new UnauthorizedError("Your current password is wrong");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await hashPassword(data.password),
      passwordChangedAt: new Date(),
    },
  });
};

export const verifyEmail = async (
  token: string
): Promise<ServiceResponse<LoginResult>> => {
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await prisma.user.findFirst({
    where: {
      emailVerificationToken: hashedToken,
      emailVerificationExpires: {
        gt: new Date(),
      },
    },
    include: { profile: true },
  });

  if (!user) {
    throw new AppError(
      "Token is invalid or has expired",
      StatusCodes.BAD_REQUEST
    );
  }

  const verifiedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      isEmailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
    },
    include: { profile: true },
  });

  const bearerToken = signToken(verifiedUser.id);

  return ServiceResponse.success(
    "Email verified successfully",
    {
      user: verifiedUser,
      token: bearerToken,
    },
    StatusCodes.OK
  );
};

export const resendVerificationEmail = async (
  email: string
): Promise<ServiceResponse<null>> => {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { profile: true },
  });

  if (!user) {
    throw new AppError("No user found with this email", StatusCodes.NOT_FOUND);
  }

  if (user.isEmailVerified) {
    throw new AppError("Email is already verified", StatusCodes.BAD_REQUEST);
  }

  const verificationOTP = await generateOTP();
  const hashedToken = crypto
    .createHash("sha256")
    .update(verificationOTP)
    .digest("hex");

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerificationToken: hashedToken,
      emailVerificationExpires: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  try {
    await new Email(user, verificationOTP).sendEmailVerification();
  } catch (error) {
    console.error("Failed to send verification email:", error);
    throw new AppError(
      "Failed to send verification email. Please try again later.",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }

  return ServiceResponse.success(
    "Verification email sent successfully",
    null,
    StatusCodes.OK
  );
};

export const oauthLogin = async (user: User) => {
  const token = signToken(user.id);
  return ServiceResponse.success("Login successful", { token, user }, 200);
};

export const setup2Fa = async (
  user: UserWithProfile | (User & { profile?: UserWithProfile["profile"] }),
  _type: string = "totp"
) => {
  if (!user.profile)
    return ServiceResponse.failure("User onboarding incomplete", null, 419);

  if (user.totp_secret != null && user.totp_secret.length >= 1)
    return ServiceResponse.failure("Existing 2FA found", 403);

  const secret = generateRandomBase32();
  const hashedsecret = encrypt(secret);

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      totp_secret: hashedsecret,
    },
  });

  const url = generateTOTP({
    issuer: "abio.site",
    secret,
    label: "Abio",
    period: 30,
    algorithm: "sha1",
  });

  return ServiceResponse.success(
    "OTP configured",
    {
      secret,
      url,
      qrcode: await QRCode.toDataURL(url, {
        version: 6,
        errorCorrectionLevel: "medium",
      }),
    },
    200
  );
};

export const verify2FAOtp = async (email: string, code: string) => {
  const user = await prisma.user.findFirst({
    where: {
      email,
    },
    include: {
      profile: true,
      roles: true,
    },
  });

  if (!user) {
    return ServiceResponse.failure("User not found.", null, 400);
  }

  if (!user.totp_secret)
    return ServiceResponse.failure(
      "User does not have 2FA configured.",
      null,
      419
    );

  const secret = decrypt(user.totp_secret!);

  const result = await verify({
    secret,
    token: code,
    crypto: tCrypto,
    algorithm: "sha1",
    digits: 6,
    period: 30,
    epochTolerance: 5,
    base32,
  });

  if (!result.valid) {
    return ServiceResponse.failure("OTP Verification failed", null);
  }

  const token = signToken(user.id);

  return ServiceResponse.success("Logged in successfully", {
    user: user,
    token,
  });
};
