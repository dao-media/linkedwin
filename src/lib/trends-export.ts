import {
  extractHashtags,
  formatCompactNumber,
  formatLibraryDate,
} from "@/lib/calendar-format";
import type { TrendsPostSummary } from "@/lib/trends-shared";
import {
  TRENDS_PERIODS,
  periodStartIso,
  type TrendsPeriodId,
} from "@/lib/trends-periods";

export const REFERENCE_RANK_OPTIONS = [
  { id: "impressions", label: "Impressions", slug: "topimpressions" },
  { id: "engagement", label: "Engagement", slug: "byengagement" },
  { id: "likes", label: "Likes", slug: "bylikes" },
  { id: "comments", label: "Comments", slug: "bycomments" },
  { id: "saves", label: "Saves", slug: "bysaves" },
  { id: "sends", label: "Sends", slug: "bysends" },
  { id: "recent", label: "Recent", slug: "recent" },
] as const;

export type ReferenceRankId = (typeof REFERENCE_RANK_OPTIONS)[number]["id"];

export const REFERENCE_COUNT_OPTIONS = [5, 10, 25, 50] as const;
export type ReferenceCount = (typeof REFERENCE_COUNT_OPTIONS)[number];

/** Discrete minimum thresholds for Content Reference filters. */
export const MIN_COMMENTS_STEPS = [0, 5, 10, 25, 50] as const;
export const MIN_REACTIONS_STEPS = [
  0, 10, 25, 50, 100, 200, 300, 400, 500, 750, 1000,
] as const;
export const MIN_ENGAGEMENT_RATE_STEPS = [0, 0.5, 1, 2, 4, 6] as const;
export const MIN_REPOSTS_STEPS = [0, 5, 10, 25, 50] as const;

/** Sentinel for max sliders — no upper bound. */
export const NO_LIMIT = Infinity;

/** Max steps mirror min numerics, then end with No Limit. */
export const MAX_COMMENTS_STEPS = [0, 5, 10, 25, 50, NO_LIMIT] as const;
export const MAX_REACTIONS_STEPS = [
  0, 10, 25, 50, 100, 200, 300, 400, 500, 750, 1000, NO_LIMIT,
] as const;
export const MAX_ENGAGEMENT_RATE_STEPS = [
  0, 0.5, 1, 2, 4, 6, NO_LIMIT,
] as const;
export const MAX_REPOSTS_STEPS = [0, 5, 10, 25, 50, NO_LIMIT] as const;

export type MinComments = (typeof MIN_COMMENTS_STEPS)[number];
export type MinReactions = (typeof MIN_REACTIONS_STEPS)[number];
export type MinEngagementRate = (typeof MIN_ENGAGEMENT_RATE_STEPS)[number];
export type MinReposts = (typeof MIN_REPOSTS_STEPS)[number];

export type MaxComments = (typeof MAX_COMMENTS_STEPS)[number];
export type MaxReactions = (typeof MAX_REACTIONS_STEPS)[number];
export type MaxEngagementRate = (typeof MAX_ENGAGEMENT_RATE_STEPS)[number];
export type MaxReposts = (typeof MAX_REPOSTS_STEPS)[number];

export function lastThresholdStep<T>(steps: readonly T[]): T {
  return steps[steps.length - 1] as T;
}

export function isNoLimit(value: number | null | undefined) {
  return value == null || !Number.isFinite(value);
}

export function formatMinCountLabel(value: number, isMaxStep: boolean) {
  return isMaxStep ? `${value}+` : String(value);
}

export function formatMinEngagementRateLabel(
  value: number,
  isMaxStep: boolean,
) {
  const base = `${value.toFixed(1)}%`;
  return isMaxStep ? `${base}+` : base;
}

export function formatMaxCountLabel(value: number, _isMaxStep?: boolean) {
  return isNoLimit(value) ? "No Limit" : String(value);
}

export function formatMaxEngagementRateLabel(
  value: number,
  _isMaxStep?: boolean,
) {
  return isNoLimit(value) ? "No Limit" : `${value.toFixed(1)}%`;
}

const PERIOD_SLUG: Record<TrendsPeriodId, string> = {
  week: "pastweek",
  month: "pastmonth",
  quarter: "pastquarter",
  "6mo": "past6months",
  year: "pastyear",
  "2yr": "past2years",
  all: "fullhistory",
};

export type ReferenceFilters = {
  period: TrendsPeriodId;
  rankBy: ReferenceRankId;
  count: ReferenceCount;
  /** Case-insensitive match against title, caption, topics, comments. */
  keyword?: string;
  /** Minimum LinkedIn comments on the post. */
  minComments?: MinComments;
  /** Maximum LinkedIn comments on the post. */
  maxComments?: MaxComments;
  /** Minimum reactions (likes). */
  minReactions?: MinReactions;
  /** Maximum reactions (likes). */
  maxReactions?: MaxReactions;
  /** Minimum engagement rate percent (e.g. 2 = 2.0%). */
  minEngagementRate?: MinEngagementRate;
  /** Maximum engagement rate percent. */
  maxEngagementRate?: MaxEngagementRate;
  /** Minimum organic reposts (excludes own). */
  minReposts?: MinReposts;
  /** Maximum organic reposts (excludes own). */
  maxReposts?: MaxReposts;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function slugifyKeyword(raw: string) {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return s || null;
}

function postMatchesKeyword(post: TrendsPostSummary, keyword: string) {
  const q = keyword.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    post.title,
    post.content,
    post.footer,
    post.topics,
    post.firstComment,
    post.secondComment,
    post.thirdComment,
    post.mediaTitle,
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
  return hay.includes(q);
}

/** Filesystem-safe time (colon is illegal on macOS). Matches Figma preview style. */
export function formatExportTimestamp(d = new Date()) {
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const yyyy = d.getFullYear();
  const hh = pad2(d.getHours());
  const min = pad2(d.getMinutes());
  return {
    date: `${mm}-${dd}-${yyyy}`,
    time: `${hh}-${min}`,
    /** Display form closer to TT:TT */
    timeDisplay: `${hh}:${min}`,
  };
}

export function buildReferenceFilterSlug(
  filters: ReferenceFilters,
  selectedCount: number,
): string {
  const rank =
    REFERENCE_RANK_OPTIONS.find((r) => r.id === filters.rankBy)?.slug ??
    filters.rankBy;
  const period = PERIOD_SLUG[filters.period] ?? filters.period;
  const kw = slugifyKeyword(filters.keyword ?? "");
  const parts = [`${rank}-${period}-${selectedCount}`];
  if ((filters.minComments ?? 0) > 0) {
    parts.push(`minc${filters.minComments}`);
  }
  if (filters.maxComments != null && !isNoLimit(filters.maxComments)) {
    parts.push(`maxc${filters.maxComments}`);
  }
  if ((filters.minReactions ?? 0) > 0) {
    parts.push(`minr${filters.minReactions}`);
  }
  if (filters.maxReactions != null && !isNoLimit(filters.maxReactions)) {
    parts.push(`maxr${filters.maxReactions}`);
  }
  if ((filters.minEngagementRate ?? 0) > 0) {
    parts.push(
      `mineng${String(filters.minEngagementRate).replace(".", "p")}`,
    );
  }
  if (
    filters.maxEngagementRate != null &&
    !isNoLimit(filters.maxEngagementRate)
  ) {
    parts.push(
      `maxeng${String(filters.maxEngagementRate).replace(".", "p")}`,
    );
  }
  if ((filters.minReposts ?? 0) > 0) {
    parts.push(`minrep${filters.minReposts}`);
  }
  if (filters.maxReposts != null && !isNoLimit(filters.maxReposts)) {
    parts.push(`maxrep${filters.maxReposts}`);
  }
  const base = parts.join("-");
  return kw ? `${base}-kw-${kw}` : base;
}

/**
 * danelinkedin_[filteringconvention]_MM-DD-YYYY_HH-mm.md
 * (HH-mm is the TT:TT slot — colon avoided for filesystem safety)
 */
export function buildReferenceFilename(
  filters: ReferenceFilters,
  selectedCount: number,
  now = new Date(),
): string {
  const { date, time } = formatExportTimestamp(now);
  return `danelinkedin_${buildReferenceFilterSlug(filters, selectedCount)}_${date}_${time}.md`;
}

export function filterReferencePosts(
  posts: TrendsPostSummary[],
  filters: ReferenceFilters,
): TrendsPostSummary[] {
  const start = periodStartIso(filters.period);
  const keyword = filters.keyword?.trim() ?? "";
  const minComments = filters.minComments ?? 0;
  const maxComments =
    filters.maxComments ?? lastThresholdStep(MAX_COMMENTS_STEPS);
  const minReactions = filters.minReactions ?? 0;
  const maxReactions =
    filters.maxReactions ?? lastThresholdStep(MAX_REACTIONS_STEPS);
  const minEngagementRate = filters.minEngagementRate ?? 0;
  const maxEngagementRate =
    filters.maxEngagementRate ?? lastThresholdStep(MAX_ENGAGEMENT_RATE_STEPS);
  const minReposts = filters.minReposts ?? 0;
  const maxReposts =
    filters.maxReposts ?? lastThresholdStep(MAX_REPOSTS_STEPS);

  const inPeriod = posts.filter((p) => {
    if (!p.publishedAt) return false;
    if (start && p.publishedAt < start) return false;
    if (keyword && !postMatchesKeyword(p, keyword)) return false;
    if (num(p.comments) < minComments) return false;
    if (!isNoLimit(maxComments) && num(p.comments) > maxComments) return false;
    if (num(p.likes) < minReactions) return false;
    if (!isNoLimit(maxReactions) && num(p.likes) > maxReactions) return false;
    if (num(p.engagementRate) < minEngagementRate) return false;
    if (
      !isNoLimit(maxEngagementRate) &&
      num(p.engagementRate) > maxEngagementRate
    ) {
      return false;
    }
    if (num(p.organicReposts) < minReposts) return false;
    if (!isNoLimit(maxReposts) && num(p.organicReposts) > maxReposts) {
      return false;
    }
    return true;
  });

  return inPeriod
    .slice()
    .sort((a, b) => compareReferencePosts(a, b, filters.rankBy))
    .slice(0, filters.count);
}

function num(v: number | null | undefined) {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Highest / newest first for the active Rank by metric. */
export function compareReferencePosts(
  a: TrendsPostSummary,
  b: TrendsPostSummary,
  rankBy: ReferenceRankId,
): number {
  let primary = 0;
  switch (rankBy) {
    case "impressions":
      primary = num(b.impressions) - num(a.impressions);
      break;
    case "engagement":
      // Rank by raw engagement count; rate is display-only (pill).
      primary = num(b.engagements) - num(a.engagements);
      if (primary === 0) {
        primary = num(b.engagementRate) - num(a.engagementRate);
      }
      break;
    case "likes":
      primary = num(b.likes) - num(a.likes);
      break;
    case "comments":
      primary = num(b.comments) - num(a.comments);
      break;
    case "saves":
      primary = num(b.saves) - num(a.saves);
      break;
    case "sends":
      primary = num(b.sends) - num(a.sends);
      break;
    case "recent":
      return (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");
    default: {
      const _exhaustive: never = rankBy;
      void _exhaustive;
      return 0;
    }
  }

  if (primary !== 0) return primary;

  // Stable, useful tie-breakers when the primary metric is tied (or all zeros).
  const byImpressions = num(b.impressions) - num(a.impressions);
  if (byImpressions !== 0) return byImpressions;
  const byEngagements = num(b.engagements) - num(a.engagements);
  if (byEngagements !== 0) return byEngagements;
  return (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");
}

function metricLine(post: TrendsPostSummary): string {
  return [
    `${formatCompactNumber(post.impressions)} impressions`,
    `${post.engagementRate.toFixed(1)}% eng rate`,
    `${formatCompactNumber(post.engagements)} engagements`,
    `${formatCompactNumber(post.likes)} likes`,
    `${formatCompactNumber(post.comments)} comments`,
    `${formatCompactNumber(post.saves)} saves`,
    `${formatCompactNumber(post.sends)} sends`,
    `${formatCompactNumber(post.organicReposts)} organic reposts`,
  ].join(" · ");
}

export function buildReferenceMarkdown(
  posts: TrendsPostSummary[],
  filters: ReferenceFilters,
  now = new Date(),
): string {
  const periodLabel =
    TRENDS_PERIODS.find((p) => p.id === filters.period)?.label ?? filters.period;
  const rankLabel =
    REFERENCE_RANK_OPTIONS.find((r) => r.id === filters.rankBy)?.label ??
    filters.rankBy;
  const { date, timeDisplay } = formatExportTimestamp(now);
  const filename = buildReferenceFilename(filters, posts.length, now);

  const lines: string[] = [
    "# LinkedIn content reference",
    "",
    "A curated packet of prior posts — for pattern-finding, voice calibration, and spotting opportunities to build on what already worked.",
    "",
    "## Export metadata",
    "",
    `- **File:** \`${filename}\``,
    `- **Exported:** ${date} ${timeDisplay}`,
    `- **Period:** ${periodLabel}`,
    `- **Ranked by:** ${rankLabel}`,
    `- **Posts included:** ${posts.length}`,
  ];
  const kw = filters.keyword?.trim();
  if (kw) {
    lines.push(`- **Keyword:** “${kw}”`);
  }
  if ((filters.minComments ?? 0) > 0) {
    lines.push(`- **Minimum comments:** ${filters.minComments}+`);
  }
  if (filters.maxComments != null && !isNoLimit(filters.maxComments)) {
    lines.push(`- **Maximum comments:** ${filters.maxComments}`);
  }
  if ((filters.minReactions ?? 0) > 0) {
    lines.push(`- **Minimum reactions:** ${filters.minReactions}+`);
  }
  if (filters.maxReactions != null && !isNoLimit(filters.maxReactions)) {
    lines.push(`- **Maximum reactions:** ${filters.maxReactions}`);
  }
  if ((filters.minEngagementRate ?? 0) > 0) {
    lines.push(
      `- **Minimum engagement rate:** ${Number(filters.minEngagementRate).toFixed(1)}%+`,
    );
  }
  if (
    filters.maxEngagementRate != null &&
    !isNoLimit(filters.maxEngagementRate)
  ) {
    lines.push(
      `- **Maximum engagement rate:** ${Number(filters.maxEngagementRate).toFixed(1)}%`,
    );
  }
  if ((filters.minReposts ?? 0) > 0) {
    lines.push(
      `- **Minimum organic reposts:** ${filters.minReposts}+`,
    );
  }
  if (filters.maxReposts != null && !isNoLimit(filters.maxReposts)) {
    lines.push(`- **Maximum organic reposts:** ${filters.maxReposts}`);
  }
  lines.push(
    "",
    "## How to use",
    "",
    "- Scan for recurring themes, open loops, and formats that earned attention.",
    "- Note questions the audience already engaged with — candidates for sequels or deeper takes.",
    "- Prefer building on strong posts over starting from a blank topic list.",
    "",
    "---",
    "",
    "## Posts",
    "",
  );

  if (posts.length === 0) {
    lines.push("_No posts matched these filters._", "");
    return lines.join("\n");
  }

  posts.forEach((post, i) => {
    const published = post.publishedAt
      ? formatLibraryDate(new Date(post.publishedAt))
      : "Unknown";
    const hashtags = extractHashtags(post.content, post.topics ?? "[]");
    lines.push(`### ${i + 1}. ${post.title || "Untitled"}`, "");
    lines.push(`- **Published:** ${published}`);
    lines.push(`- **Metrics:** ${metricLine(post)}`);
    if (hashtags.length) {
      lines.push(`- **Hashtags / topics:** ${hashtags.join(" ")}`);
    }
    if (post.mediaType) {
      lines.push(
        `- **Media:** ${post.mediaType}${post.mediaTitle ? ` — ${post.mediaTitle}` : ""}`,
      );
    }
    lines.push("", "#### Caption", "", post.content.trim() || "_(empty)_", "");
    const comments = [post.firstComment, post.secondComment, post.thirdComment]
      .map((c) => c?.trim())
      .filter((c): c is string => Boolean(c));
    if (comments.length) {
      lines.push("#### Pinned comments", "");
      comments.forEach((c, idx) => {
        lines.push(`${idx + 1}. ${c}`, "");
      });
    }
    lines.push("---", "");
  });

  return lines.join("\n");
}

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function formatReferenceMetric(
  post: TrendsPostSummary,
  rankBy: ReferenceRankId,
): string {
  switch (rankBy) {
    case "impressions":
      return formatCompactNumber(post.impressions);
    case "engagement":
      return formatCompactNumber(post.engagements);
    case "likes":
      return formatCompactNumber(post.likes);
    case "comments":
      return formatCompactNumber(post.comments);
    case "saves":
      return formatCompactNumber(post.saves);
    case "sends":
      return formatCompactNumber(post.sends);
    case "recent":
      return post.publishedAt
        ? formatLibraryDate(new Date(post.publishedAt))
        : "—";
    default:
      return "";
  }
}
