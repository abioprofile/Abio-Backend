import { TUpdateBackground, TUpdateCorners, TUpdateFont } from "@/schemas/profile.schema";
import { ServiceResponse } from "@/utils/serviceResponse";
import { StatusCodes } from "http-status-codes";

// user display preferences
class PreferenceService {
    async updateBackgroundPreferences(userId: string, data: TUpdateBackground): Promise<ServiceResponse> {
        return ServiceResponse.failure("", null, StatusCodes.NOT_IMPLEMENTED);
    }
    
    async updateFontPreferences(userId: string, data: TUpdateFont): Promise<ServiceResponse> {
        return ServiceResponse.failure("", null, StatusCodes.NOT_IMPLEMENTED);
    }

    async updateCornerPreferences(userId: string, data: TUpdateCorners): Promise<ServiceResponse> {
        return ServiceResponse.failure("", null, StatusCodes.NOT_IMPLEMENTED);
    }
}

export default new PreferenceService();