import { ServiceResponse } from "@/shared/utils/serviceResponse";
import { StatusCodes } from "http-status-codes";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { TCreateUser, TUpdateUser } from "./user.schemas";
import type { TLogin } from "@/schemas/auth.schema";
import env from "@/env";
import { logger } from "@/server";
import { prisma } from "@/shared/config/database";
import { UserWithProfile, LoginResult } from "@/shared/types";
import { User } from "@prisma/client";
import { AppError } from "@/shared/utils/appError";
import { customAlphabet } from "nanoid";
import Email from "@/shared/utils/email";
import QRCode from "qrcode";

import { verify } from "@otplib/totp";
import { crypto as tCrypto } from "@otplib/plugin-crypto-node";
import { base32 } from "@otplib/plugin-base32-scure";
import { generateTOTP } from "@otplib/uri";
import { generateRandomBase32 } from "@/shared/utils/uniqueId";
import { decrypt, encrypt } from "@/shared/utils/encrpyt";

const signToken = (id: string): string => {
  const secret = env.JWT_SECRET;
  const expiresIn = env.JWT_EXPIRES_IN;
  return jwt.sign({ id }, secret, { expiresIn } as any);
};

export const generateOTP = async () => {
  const alphabet = "0123456789";
  const nanoid = customAlphabet(alphabet, 6);
  return nanoid();
};

export const comparePassword = async (
  candidatePassword: string,
  userPassword: string
): Promise<boolean> => {
  return bcrypt.compare(candidatePassword, userPassword);
};

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 12);
};

export const create = async (
  payload: TCreateUser
): Promise<ServiceResponse<UserWithProfile | null>> => {
  const existingUser = await prisma.user.findUnique({
    where: { email: payload.email },
  });

  if (existingUser) {
    throw new AppError(
      "A user with this email already exists.",
      StatusCodes.CONFLICT
    );
  }

  const verificationOTP = await generateOTP();
  const hashedToken = crypto
    .createHash("sha256")
    .update(verificationOTP)
    .digest("hex");

  const user = await prisma.user.create({
    data: {
      email: payload.email,
      name: payload.name,
      password: payload.password,
      emailVerificationToken: hashedToken,
      emailVerificationExpires: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  await prisma.profile.create({
    data: {
      userId: user.id,
    },
  });

  const newUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: { profile: true },
  });

  try {
    await new Email(newUser!, verificationOTP).sendEmailVerification();
  } catch (error) {
    console.error("Failed to send verification email:", error);
  }

  return ServiceResponse.success(
    "User created successfully. Please check your email to verify your account.",
    newUser,
    StatusCodes.CREATED
  );
};

export const findById = async (
  id: string
): Promise<ServiceResponse<UserWithProfile | null>> => {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      profile: {
        include: {
          display: true,
        },
      },
    },
  });

  if (!user) {
    return ServiceResponse.failure(
      "User not found",
      null,
      StatusCodes.NOT_FOUND
    );
  }

  return ServiceResponse.success("User retrieved successfully", user);
};

export const findByEmail = async (email: string) => {
  return prisma.user.findUnique({ where: { email } });
};

export const update = async (data: {
  body: TUpdateUser;
  id: string;
}): Promise<ServiceResponse<UserWithProfile>> => {
  const updatedUser = await prisma.user.update({
    where: { id: data.id },
    data: data.body,
    include: { profile: true },
  });

  return ServiceResponse.success("User updated successfully", updatedUser);
};

export const deleteUser = async (id: string): Promise<ServiceResponse<null>> => {
  await prisma.user.delete({
    where: { id },
  });

  return ServiceResponse.success(
    "User deleted successfully",
    null,
    StatusCodes.OK
  );
};

export const login = async (
  user: TLogin
): Promise<ServiceResponse<LoginResult | null>> => {
  const foundUser = await prisma.user.findUnique({
    where: { email: user.email },
  });

  console.log("Found user:", foundUser);

  if (!foundUser) {
    return ServiceResponse.failure<LoginResult | null>(
      "Incorrect email or password",
      null,
      StatusCodes.BAD_REQUEST
    );
  }

  if (!foundUser.password) {
    return ServiceResponse.failure<LoginResult | null>(
      "User account has no password set",
      null,
      StatusCodes.BAD_REQUEST
    );
  }

  if (!(await comparePassword(user.password, foundUser.password))) {
    return ServiceResponse.failure<LoginResult | null>(
      "Incorrect email or password",
      null,
      StatusCodes.BAD_REQUEST
    );
  }

  if (foundUser.totp_secret != null) {
    return ServiceResponse.success("", {
      action: "2fa",
    });
  }

  const token = signToken(foundUser.id);

  return ServiceResponse.success("Logged in successfully", {
    user: foundUser,
    token,
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

export const updateEmail = async (
  user: User,
  email: string
): Promise<ServiceResponse> => {
  try {
    const verificationOTP = await generateOTP();
    const hashedToken = crypto
      .createHash("sha256")
      .update(verificationOTP)
      .digest("hex");

    await prisma.user.update({
      where: { id: user.id },
      data: {
        email,
        isEmailVerified: false,
        emailVerificationToken: hashedToken,
        emailVerificationExpires: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    return await resendVerificationEmail(email);
  } catch (error) {
    logger.error(error);
    return ServiceResponse.failure("An error occurred", null, 500);
  }
};

export const setup2Fa = async (user: UserWithProfile, _type: string = "totp") => {
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

/** Namespace object for existing `userService.method()` call sites (auth, etc.). */
export const userService = {
  create,
  findById,
  findByEmail,
  update,
  delete: deleteUser,
  login,
  comparePassword,
  hashPassword,
  generateOTP,
  verifyEmail,
  resendVerificationEmail,
  oauthLogin,
  updateEmail,
  setup2Fa,
  verify2FAOtp,
};
