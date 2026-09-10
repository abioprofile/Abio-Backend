import z from "zod";

export const analyticsRangeSchema = z.object({
  query: z.object({
    range: z.enum(["7d", "30d"]).default("30d"),
  }),
});

export type TAnalyticsRangeQuery = z.infer<typeof analyticsRangeSchema>["query"];
