import { AuthenticatedRequest } from "@/types/express";
import { TUpdateProfile, TCheckUsername } from "@/schemas/profile.schema";

export interface UpdateProfileRequest extends AuthenticatedRequest {
  body: TUpdateProfile;
}

export interface CheckUsernameRequest {
  query: TCheckUsername;
}

export interface GetPublicProfileRequest {
  params: {
    username: string;
  };
}
