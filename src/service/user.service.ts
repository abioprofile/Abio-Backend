import { ServiceResponse } from "@/utils/serviceResponse";
import { StatusCodes } from "http-status-codes";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { TLogin, TCreateUser, TUpdateUser } from "@/schemas/index";
import env from "@/env";
import { prisma } from "@/server";
import { UserWithProfile, LoginResult } from "@/types";
import { User } from "@prisma/client";
import { AppError } from "@/utils/appError";
import { customAlphabet } from "nanoid";

const signToken = (id: string): string => {
  const secret = env.JWT_SECRET;
  const expiresIn = env.JWT_EXPIRES_IN;

  return jwt.sign({ id }, secret, { expiresIn } as any);
};

export class UserService {
  async create(
    payload: TCreateUser
  ): Promise<ServiceResponse<UserWithProfile | null>> {
    // Check if user with this email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: payload.email },
    });

    if (existingUser) {
      throw new AppError(
        "A user with this email already exists.",
        StatusCodes.CONFLICT
      );
    }

    // Hash the password before storing
    const hashedPassword = await this.hashPassword(payload.password);

    // Create user first
    const user = await prisma.user.create({
      data: {
        email: payload.email,
        firstName: payload.firstName,
        lastName: payload.lastName,
        password: hashedPassword,
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

    return ServiceResponse.success(
      "User created successfully",
      newUser,
      StatusCodes.CREATED
    );
  }

  async findById(id: string): Promise<ServiceResponse<UserWithProfile | null>> {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });

    if (!user) {
      return ServiceResponse.failure(
        "User not found",
        null,
        StatusCodes.NOT_FOUND
      );
    }

    return ServiceResponse.success("User retrieved successfully", user);
  }

  async update(data: {
    body: TUpdateUser;
    id: string;
  }): Promise<ServiceResponse<UserWithProfile>> {
    const updatedUser = await prisma.user.update({
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
      StatusCodes.OK
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

    if (!(await this.comparePassword(user.password, foundUser.password))) {
      return ServiceResponse.failure<LoginResult | null>(
        "Incorrect email or password",
        null,
        StatusCodes.BAD_REQUEST
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
    userPassword: string
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
}

export const userService = new UserService();
