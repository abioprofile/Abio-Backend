import { ServiceResponse } from "@/shared/utils/serviceResponse";
import { StatusCodes } from "http-status-codes";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { TUpdateUser } from "./user.schemas";
import { logger } from "@/server";
import { prisma } from "@/shared/config/database";
import { UserWithProfile } from "@/shared/types";
import { User } from "@prisma/client";
import { customAlphabet } from "nanoid";
import Email from "@/shared/utils/email";

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

    const updatedUser = await prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    await new Email(updatedUser!, verificationOTP).sendEmailVerification();

    return ServiceResponse.success(
      "Verification email sent successfully",
      null,
      StatusCodes.OK
    );
  } catch (error) {
    logger.error(error);
    return ServiceResponse.failure("An error occurred", null, 500);
  }
};

/** Namespace object for existing `userService.method()` call sites. */
export const userService = {
  findById,
  findByEmail,
  update,
  delete: deleteUser,
  comparePassword,
  hashPassword,
  generateOTP,
  updateEmail,
};
