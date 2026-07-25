/** Shared engagement / impressions helpers for library + trends. */

export type ImpressionsSource =
  | "linkedin_export"
  | "estimated"
  | "none"
  | "unknown";

export function impressionsSourceFromRaw(
  rawJson: string | null | undefined,
): ImpressionsSource {
  if (!rawJson) return "unknown";
  try {
    const parsed = JSON.parse(rawJson) as { impressionsSource?: string };
    const src = parsed.impressionsSource;
    if (
      src === "linkedin_export" ||
      src === "estimated" ||
      src === "none"
    ) {
      return src;
    }
  } catch {
    // ignore
  }
  return "unknown";
}

/**
 * Per-post engagement rate (engagements / impressions * 100).
 * Returns null when impressions were estimated from a median rate — that
 * circular math makes every post look ~identical.
 */
export function computeEngagementRate(input: {
  engagements: number | null | undefined;
  impressions: number | null | undefined;
  impressionsSource?: ImpressionsSource | string | null;
}): number | null {
  if (input.impressionsSource === "estimated") return null;
  const impressions = input.impressions ?? 0;
  const engagements = input.engagements;
  if (engagements == null || impressions <= 0) return null;
  return (engagements / impressions) * 100;
}
