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
    const parsed = JSON.parse(rawJson) as {
      impressionsSource?: string;
      source?: string;
    };
    const src = parsed.impressionsSource;
    if (
      src === "linkedin_export" ||
      src === "estimated" ||
      src === "none"
    ) {
      return src;
    }
    // Legacy snapshots from early Favikon imports used estimated impressions
    // without impressionsSource — treat as estimated so eng rates stay hidden.
    if (
      parsed.source === "favikon" ||
      parsed.source === "favikon_backfill" ||
      parsed.source === "linkedin_top_posts_stub"
    ) {
      return "estimated";
    }
    if (
      parsed.source === "linkedin+favikon" ||
      parsed.source === "enrich_favikon_linkedin" ||
      parsed.source === "aggregate_analytics" ||
      parsed.source === "repair_metrics" ||
      parsed.source === "linkedin_export"
    ) {
      // May still be estimated if impressionsSource missing on old rows
      return src === "estimated" ? "estimated" : "linkedin_export";
    }
  } catch {
    // ignore
  }
  return "unknown";
}

/** LinkedIn Aggregate TOP POSTS total when per-reaction breakdown is unavailable. */
export function linkedinEngagementsFromRaw(
  rawJson: string | null | undefined,
): number | null {
  if (!rawJson) return null;
  try {
    const parsed = JSON.parse(rawJson) as {
      linkedinEngagements?: unknown;
      engagements?: unknown;
    };
    for (const key of ["linkedinEngagements", "engagements"] as const) {
      const n = Number(parsed[key]);
      if (Number.isFinite(n) && n >= 0) return Math.round(n);
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Prefer reaction breakdown (likes+comments+shares+saves+sends).
 * Fall back to LinkedIn export total stored in raw_json when breakdown is empty
 * (common for recent posts imported from AggregateAnalytics TOP POSTS only).
 */
export function resolveEngagementTotal(input: {
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  sends?: number | null;
  rawJson?: string | null;
}): number | null {
  const parts = [
    input.likes,
    input.comments,
    input.shares,
    input.saves,
    input.sends,
  ];
  const allMissing = parts.every((p) => p == null);
  const breakdown = parts.reduce<number>((sum, p) => sum + (p ?? 0), 0);
  if (breakdown > 0) return breakdown;

  const fromLinkedIn = linkedinEngagementsFromRaw(input.rawJson);
  if (fromLinkedIn != null) return fromLinkedIn;

  if (allMissing && !input.rawJson) return null;
  return breakdown;
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
