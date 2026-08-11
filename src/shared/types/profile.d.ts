import { AuthenticatedRequest } from "@/shared/types/express";
import {
  TUpdateProfile,
  TCheckUsername,
} from "@/modules/profiles/profile.schemas";
import {
  TUpdateFont,
  TUpdateCorners,
  TUpdateBackground,
  TUpdatePreferences,
} from "@/modules/preferences/preferences.schemas";

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

export interface UpdatePreferencesRequest extends AuthenticatedRequest {
  body: TUpdatePreferences;
}

export type {
  TUpdateFont,
  TUpdateCorners,
  TUpdateBackground,
  TUpdatePreferences,
};
