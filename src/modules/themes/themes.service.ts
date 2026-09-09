import { Prisma } from "@prisma/client";
import { StatusCodes } from "http-status-codes";
import { prisma } from "@/shared/config/database";
import { ServiceResponse } from "@/shared/utils/serviceResponse";
import type { TCreateTheme, TUpdateTheme } from "./themes.schemas";

const notFound = () =>
  ServiceResponse.failure("Theme not found", null, StatusCodes.NOT_FOUND);
const conflict = () =>
  ServiceResponse.failure(
    "A theme with this name already exists",
    null,
    StatusCodes.CONFLICT,
  );
const isCode = (error: unknown, code: string) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
export const getThemes = async () =>
  ServiceResponse.success(
    "Themes retrieved",
    await prisma.displayTheme.findMany({ orderBy: { createdAt: "desc" } }),
  );
export const getTheme = async (id: string) => {
  const theme = await prisma.displayTheme.findUnique({ where: { id } });
  return theme ? ServiceResponse.success("Theme retrieved", theme) : notFound();
};
export const saveTheme = async (data: TCreateTheme) => {
  try {
    return ServiceResponse.success(
      "Theme created successfully",
      await prisma.displayTheme.create({ data }),
    );
  } catch (error) {
    if (isCode(error, "P2002")) return conflict();
    throw error;
  }
};
/** Provided config sections replace that section; omitted sections are retained. */
export const updateTheme = async (id: string, data: TUpdateTheme) => {
  try {
    return ServiceResponse.success(
      "Theme updated successfully",
      await prisma.displayTheme.update({ where: { id }, data }),
    );
  } catch (error) {
    if (isCode(error, "P2025")) return notFound();
    if (isCode(error, "P2002")) return conflict();
    throw error;
  }
};
/** Reject deleting referenced themes, including selections racing with this request. */
export const deleteTheme = async (id: string) => {
  try {
    return await prisma.$transaction(async (tx) => {
      const theme = await tx.displayTheme.findUnique({ where: { id } });
      if (!theme) return notFound();
      // Lock the parent row: FK inserts must wait until this transaction completes.
      await tx.$queryRaw`SELECT id FROM theme_configurations WHERE id = ${id} FOR UPDATE`;
      const usage = await tx.displayPreference.count({
        where: { selected_theme: id },
      });
      if (usage > 0)
        return ServiceResponse.failure(
          "This theme is used by profiles and cannot be deleted. Move those profiles to another theme first.",
          null,
          StatusCodes.CONFLICT,
        );
      await tx.displayTheme.delete({ where: { id } });
      return ServiceResponse.success("Theme deleted successfully", null);
    });
  } catch (error) {
    if (isCode(error, "P2025")) return notFound();
    if (isCode(error, "P2003"))
      return ServiceResponse.failure(
        "This theme is used by profiles and cannot be deleted",
        null,
        StatusCodes.CONFLICT,
      );
    throw error;
  }
};
