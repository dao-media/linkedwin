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
  const base = `${rank}-${period}-${selectedCount}`;
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
  const inPeriod = posts.filter((p) => {
    if (!p.publishedAt) return false;
    if (start && p.publishedAt < start) return false;
    if (keyword && !postMatchesKeyword(p, keyword)) return false;
    return true;
  });

  const sorted = inPeriod.slice().sort((a, b) => {
    switch (filters.rankBy) {
      case "impressions":
        return b.impressions - a.impressions;
      case "engagement":
        return b.engagements - a.engagements || b.engagementRate - a.engagementRate;
      case "likes":
        return b.likes - a.likes;
      case "comments":
        return b.comments - a.comments;
      case "saves":
        return b.saves - a.saves;
      case "sends":
        return b.sends - a.sends;
      case "recent":
        return (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");
      default:
        return 0;
    }
  });

  return sorted.slice(0, filters.count);
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
      return `${post.engagementRate.toFixed(1)}% · ${formatCompactNumber(post.engagements)}`;
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
