import { ServiceResponse } from "@/utils/serviceResponse";
import { StatusCodes } from "http-status-codes";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { TLogin, TCreateUser, TUpdateUser } from "@/schemas/index";
import env from "@/env";
import { prisma } from "@/server";
import { UserWithProfile, LoginResult } from "@/types";
import { User } from "@prisma/client";
import { AppError } from "@/utils/appError";
import { customAlphabet } from "nanoid";
import Email from "@/utils/email";
import { Response } from "express";

const signToken = (id: string): string => {
  const secret = env.JWT_SECRET;
  const expiresIn = env.JWT_EXPIRES_IN;

  return jwt.sign({ id }, secret, { expiresIn } as any);
};

export class UserService {
  async create(
    payload: TCreateUser,
  ): Promise<ServiceResponse<UserWithProfile | null>> {
    // Check if user with this email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: payload.email },
    });

    if (existingUser) {
      throw new AppError(
        "A user with this email already exists.",
        StatusCodes.CONFLICT,
      );
    }

    // Generate OTP for email verification
    const verificationOTP = await this.generateOTP();
    const hashedToken = crypto
      .createHash("sha256")
      .update(verificationOTP)
      .digest("hex");

    // Create user first (password will be hashed by Prisma middleware)
    const user = await prisma.user.create({
      data: {
        email: payload.email,
        name: payload.name,
        password: payload.password,
        emailVerificationToken: hashedToken,
        emailVerificationExpires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
    });

    // Create profile afterwards
    await prisma.profile.create({
      data: {
        userId: user.id,
      },
    });

    // Fetch user with profile
    const newUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { profile: true },
    });

    // Send verification email
    try {
      await new Email(newUser!, verificationOTP).sendEmailVerification();
    } catch (error) {
      console.error("Failed to send verification email:", error);
      // Don't fail user creation if email fails
    }

    return ServiceResponse.success(
      "User created successfully. Please check your email to verify your account.",
      newUser,
      StatusCodes.CREATED,
    );
  }

  async findById(id: string): Promise<ServiceResponse<UserWithProfile | null>> {
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
        StatusCodes.NOT_FOUND,
      );
    }

    return ServiceResponse.success("User retrieved successfully", user);
  }

  async update(data: {
    body: TUpdateUser;
    id: string;
  }): Promise<ServiceResponse<UserWithProfile>> {
    let updatedUser = await prisma.user.update({
      where: { id: data.id },
      data: data.body,
      include: { profile: true },
    });

    return ServiceResponse.success("User updated successfully", updatedUser);
  }

  async delete(id: string): Promise<ServiceResponse<null>> {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    // Delete user (cascade will handle related records based on schema)
    await prisma.user.delete({
      where: { id },
    });

    return ServiceResponse.success(
      "User deleted successfully",
      null,
      StatusCodes.OK,
    );
  }

  async login(user: TLogin): Promise<ServiceResponse<LoginResult | null>> {
    const foundUser = await prisma.user.findUnique({
      where: { email: user.email },
    });

    console.log("Found user:", foundUser);

    if (!foundUser) {
      return ServiceResponse.failure<LoginResult | null>(
        "Incorrect email or password",
        null,
        StatusCodes.BAD_REQUEST,
      );
    }

    if (!foundUser.password) {
      return ServiceResponse.failure<LoginResult | null>(
        "User account has no password set",
        null,
        StatusCodes.BAD_REQUEST,
      );
    }

    if (!(await this.comparePassword(user.password, foundUser.password))) {
      return ServiceResponse.failure<LoginResult | null>(
        "Incorrect email or password",
        null,
        StatusCodes.BAD_REQUEST,
      );
    }

    const token = signToken(foundUser.id);

    return ServiceResponse.success("Logged in successfully", {
      user: foundUser,
      token,
    });
  }

  async comparePassword(
    candidatePassword: string,
    userPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(candidatePassword, userPassword);
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  async generateOTP() {
    const alphabet = "0123456789";
    const nanoid = customAlphabet(alphabet, 6);
    return nanoid();
  }

  async verifyEmail(token: string): Promise<ServiceResponse<LoginResult>> {
    // Hash the provided token
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Find user with this token that hasn't expired
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
        StatusCodes.BAD_REQUEST,
      );
    }

    // Update user as verified
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
      StatusCodes.OK,
    );
  }

  async resendVerificationEmail(email: string): Promise<ServiceResponse<null>> {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!user) {
      throw new AppError(
        "No user found with this email",
        StatusCodes.NOT_FOUND,
      );
    }

    if (user.isEmailVerified) {
      throw new AppError("Email is already verified", StatusCodes.BAD_REQUEST);
    }

    // Generate new OTP
    const verificationOTP = await this.generateOTP();
    const hashedToken = crypto
      .createHash("sha256")
      .update(verificationOTP)
      .digest("hex");

    // Update user with new token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: hashedToken,
        emailVerificationExpires: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    // Send verification email
    try {
      await new Email(user, verificationOTP).sendEmailVerification();
    } catch (error) {
      console.error("Failed to send verification email:", error);
      throw new AppError(
        "Failed to send verification email. Please try again later.",
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    }

    return ServiceResponse.success(
      "Verification email sent successfully",
      null,
      StatusCodes.OK,
    );
  }

  // generateAccessToken(user: User, res: Response): string {
  //   const { password: _, ...userWithoutPassword } = user;

  //   const token = signToken(user.id);
  //   return token;
  // }
}

export const userService = new UserService();
