import { PrismaClient, Prisma } from "@prisma/client";

// Prisma transaction types
export type PrismaTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// User service result type - using Prisma's generated types
export type UserWithProfile = Prisma.UserGetPayload<{
  include: { profile: true };
}>;

// Type for the login method return
export interface LoginResult {
  user?: {
    id: string;
    name: string;
    email: string;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  token?: string;
  action?: string;
}

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
