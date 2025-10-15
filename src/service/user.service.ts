import { ServiceResponse } from "@/utils/serviceResponse";
import { StatusCodes } from "http-status-codes";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { TLogin, TCreateUser, TUpdateUser } from "@/schemas/index";
import env from "@/env";
import { prisma } from "@/server";
import { UserWithProfile, LoginResult } from "@/types";

const signToken = (id: string): string => {
  const secret = env.JWT_SECRET;
  const expiresIn = env.JWT_EXPIRES_IN;

  return jwt.sign({ id }, secret, { expiresIn } as any);
};

export class UserService {
  // Retrieves all users from the database
  async findAll(): Promise<ServiceResponse<UserWithProfile[]>> {
    const users = await prisma.user.findMany({
      where: { active: true },
      include: { profile: true },
    });

    if (!users || users.length === 0) {
      return ServiceResponse.failure<UserWithProfile[]>(
        "No Users found",
        [],
        StatusCodes.OK
      );
    }
    return ServiceResponse.success("Users retrieved successfully", users);
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

    if (!(await bcrypt.compare(user.password, foundUser.password))) {
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
}

export const userService = new UserService();
