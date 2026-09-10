/** UTC calendar date at midnight for ProfileAnalyticsDaily.date */
export const utcDay = (d: Date = new Date()): Date => {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

export type AnalyticsRange = "7d" | "30d";

export const rangeToDays = (range: AnalyticsRange): number =>
  range === "7d" ? 7 : 30;

/** Inclusive UTC window ending today (UTC), spanning `days` calendar days. */
export const rangeWindow = (range: AnalyticsRange) => {
  const days = rangeToDays(range);
  const to = utcDay();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  return { from, to, days };
};

export const clickRate = (views: number, clicks: number): number => {
  if (views <= 0) return 0;
  return Math.round((clicks / views) * 10000) / 10000; // 4 decimal places
};
