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

// Type for auth success payloads (verify / oauth / 2FA)
export interface LoginResult {
  user?: {
    id: string;
    name: string;
    email: string;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  accessToken?: string;
  refreshToken?: string;
  /** @deprecated prefer accessToken — kept briefly for older clients */
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
