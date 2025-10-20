import { PrismaClient, Prisma, Habit } from "@prisma/client";

// Prisma transaction types
export type PrismaTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// Profile creation payload type
export interface ProfileCreatePayload {
  userId: string;
  selectedHabits: Habit[];
}

// User service result type - using Prisma's generated types
export type UserWithProfile = Prisma.UserGetPayload<{
  include: { profile: true };
}>;

// Type for the login method return
export interface LoginResult {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  token: string;
}

// Re-export device types
export type {
  CreateDeviceRequest,
  UpdateDeviceRequest,
  DeleteDeviceRequest,
  GetDeviceRequest,
} from "./device";

// Re-export browser history types
export type { CategorizeRequest } from "./browserHistory";

// Re-export profile types
export type {
  UpdateProfileRequest,
  CheckUsernameRequest,
  GetPublicProfileRequest,
} from "./profile";

// Re-export link types
export type {
  CreateLinkRequest,
  GetLinkRequest,
  UpdateLinkRequest,
  DeleteLinkRequest,
  ReorderLinksRequest,
  TrackLinkClickRequest,
} from "./link";
