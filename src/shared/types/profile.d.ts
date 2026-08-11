import { AuthenticatedRequest } from "@/shared/types/express";
import { TUpdateProfile, TCheckUsername, TUpdateFont, TUpdateCorners, TUpdateBackground, TUpdatePreferences } from "@/schemas/profile.schema";

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
