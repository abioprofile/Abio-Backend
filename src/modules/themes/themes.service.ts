import { prisma } from "@/shared/config/database";
import { ServiceResponse } from "@/shared/utils/serviceResponse";
import type { TCreateTheme } from "./themes.schemas";

export const getThemes = async () => {
  const themes = await prisma.displayTheme.findMany();
  return ServiceResponse.success("", themes);
};

export const saveTheme = async (data: TCreateTheme) => {
  const theme = await prisma.displayTheme.create({
    data,
  });

  return ServiceResponse.success("Theme created successfully", theme);
};
