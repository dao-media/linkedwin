export const TRENDS_PERIODS = [
  { id: "week", label: "Past Week", days: 7 },
  { id: "month", label: "Past Month", days: 30 },
  { id: "quarter", label: "Past Quarter", days: 91 },
  { id: "6mo", label: "Past 6 Months", days: 183 },
  { id: "year", label: "Past Year", days: 365 },
  { id: "2yr", label: "Past 2 Years", days: 730 },
  { id: "all", label: "Full History", days: null },
] as const;

export type TrendsPeriodId = (typeof TRENDS_PERIODS)[number]["id"];

export const FOLLOWER_GROWTH_PERIODS = [
  "week",
  "month",
  "quarter",
  "6mo",
  "year",
  "all",
] as const satisfies readonly TrendsPeriodId[];

export const DAILY_IMPRESSIONS_PERIODS = [
  "week",
  "month",
  "quarter",
] as const satisfies readonly TrendsPeriodId[];

export const WEEKLY_IMPRESSIONS_PERIODS = [
  "month",
  "quarter",
  "6mo",
  "year",
  "2yr",
  "all",
] as const satisfies readonly TrendsPeriodId[];

export const ENGAGEMENT_PERIODS = [
  "week",
  "month",
  "quarter",
  "6mo",
  "year",
  "2yr",
  "all",
] as const satisfies readonly TrendsPeriodId[];

export const ORGANIC_REPOSTS_PERIODS = [
  "month",
  "quarter",
  "year",
  "all",
] as const satisfies readonly TrendsPeriodId[];

export const LEADERS_PERIODS = [
  "week",
  "month",
  "quarter",
  "6mo",
  "year",
  "2yr",
  "all",
] as const satisfies readonly TrendsPeriodId[];

export function isTrendsPeriodId(v: string | null | undefined): v is TrendsPeriodId {
  return TRENDS_PERIODS.some((p) => p.id === v);
}

export function periodStartIso(
  periodId: TrendsPeriodId,
  now = new Date(),
): string | null {
  const period = TRENDS_PERIODS.find((p) => p.id === periodId) ?? TRENDS_PERIODS[1];
  if (period.days == null) return null;
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - period.days);
  return d.toISOString();
}

export function periodsFor(
  ids: readonly TrendsPeriodId[],
): { id: TrendsPeriodId; label: string }[] {
  return ids.map((id) => {
    const p = TRENDS_PERIODS.find((x) => x.id === id)!;
    return { id: p.id, label: p.label };
  });
}
