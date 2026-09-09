import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const db = vi.hoisted(() => ({
  displayTheme: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  displayPreference: { count: vi.fn() },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
}));
vi.mock("@/shared/config/database", () => ({ prisma: db }));
import {
  updateTheme,
  deleteTheme,
  saveTheme,
  getTheme,
} from "@/modules/themes/themes.service";
import {
  updateThemeSchema,
  createThemeSchema,
} from "@/modules/themes/themes.schemas";
const id = "58c71b4d-d3ed-4fb5-b3a4-15d9536d857e";
const known = (code: string) =>
  new Prisma.PrismaClientKnownRequestError("test", {
    code,
    clientVersion: "6",
  });
beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((fn) => fn(db));
  db.displayTheme.findUnique.mockResolvedValue({ id, name: "Theme" });
  db.displayPreference.count.mockResolvedValue(0);
});
describe("Theme management", () => {
  it("validates partial changes and rejects empty/blank/invalid ids", () => {
    expect(
      updateThemeSchema.parse({ params: { id }, body: { name: " New " } }).body,
    ).toEqual({ name: "New" });
    for (const body of [{}, { name: " " }, { unknown: true }])
      expect(
        updateThemeSchema.safeParse({ params: { id }, body }).success,
      ).toBe(false);
    expect(
      updateThemeSchema.safeParse({
        params: { id: "bad" },
        body: { name: "New" },
      }).success,
    ).toBe(false);
    expect(
      createThemeSchema.safeParse({ body: { name: "Only name" } }).success,
    ).toBe(false);
  });
  it("updates only requested sections", async () => {
    db.displayTheme.update.mockResolvedValue({ id, name: "New" });
    expect((await updateTheme(id, { name: "New" })).success).toBe(true);
    expect(db.displayTheme.update).toHaveBeenCalledWith({
      where: { id },
      data: { name: "New" },
    });
  });
  it("maps missing theme and duplicate names", async () => {
    db.displayTheme.update.mockRejectedValue(known("P2025"));
    expect((await updateTheme(id, { name: "New" })).statusCode).toBe(404);
    db.displayTheme.update.mockRejectedValue(known("P2002"));
    expect((await updateTheme(id, { name: "New" })).statusCode).toBe(409);
    db.displayTheme.create.mockRejectedValue(known("P2002"));
    expect(
      (
        await saveTheme({
          name: "New",
          font_config: {
            name: "Arial",
            italic: false,
            underline: false,
            weight: "regular",
          },
          corner_config: { type: "round", shadow: "none" },
          wallpaper_config: { type: "fill", backgroundColor: "#ffffff" },
        })
      ).statusCode,
    ).toBe(409);
  });
  it("blocks deletion of a selected theme", async () => {
    db.displayPreference.count.mockResolvedValue(2);
    expect((await deleteTheme(id)).statusCode).toBe(409);
    expect(db.$queryRaw).toHaveBeenCalled();
    expect(db.displayTheme.delete).not.toHaveBeenCalled();
  });
  it("deletes unused themes and handles missing records", async () => {
    expect((await deleteTheme(id)).success).toBe(true);
    expect(db.displayTheme.delete).toHaveBeenCalledWith({ where: { id } });
    db.displayTheme.findUnique.mockResolvedValue(null);
    expect((await deleteTheme(id)).statusCode).toBe(404);
    expect((await getTheme(id)).statusCode).toBe(404);
  });
});
