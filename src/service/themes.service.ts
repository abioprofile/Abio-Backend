import { TCreateTheme } from "@/schemas/profile.schema";
import { prisma } from "@/server";
import { ServiceResponse } from "@/utils/serviceResponse";

class ThemeService {
  constructor() {}

  async getThemes(): Promise<ServiceResponse<any>> {
    const themes = await prisma.displayTheme.findMany();
    return ServiceResponse.success("", themes);
  }

  async saveTheme(_data: TCreateTheme): Promise<ServiceResponse<any>> {
    const theme = await prisma.displayTheme.create({
      data: _data,
    });

    return ServiceResponse.success("Theme created successfully", theme);
  }
}

export default new ThemeService();
