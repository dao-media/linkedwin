import { and, asc, desc, eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import {
  extractHashtags,
  normalizeHashtagKey,
} from "./calendar-format";
import { db, ensureSchema } from "./db";
import {
  computeEngagementRate,
  impressionsSourceFromRaw,
} from "./metrics";
import {
  automationJobs,
  dailyMetrics,
  followerSnapshots,
  metricsSnapshots,
  posts,
} from "./schema";
import { getSetting } from "./settings";
import type { TrendsPeriodId } from "./trends-periods";
import { periodStartIso } from "./trends-periods";
import type {
  TrendsHashtagRow,
  TrendsPostSummary,
  TrendsSeriesPoint,
} from "./trends-shared";

export type {
  TrendsHashtagRow,
  TrendsPostSummary,
  TrendsSeriesPoint,
  TrendsDashboard,
} from "./trends-shared";
export { formatFollowersDelta } from "./trends-shared";

type PostMetrics = {
  post: typeof posts.$inferSelect;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  sends: number;
  reposts: number;
  organicReposts: number;
  engagements: number;
  engagementRate: number;
};

function dayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function weekKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const tmp = new Date(d);
  tmp.setHours(0, 0, 0, 0);
  // ISO week start Monday
  const day = (tmp.getDay() + 6) % 7;
  tmp.setDate(tmp.getDate() - day);
  return dayKey(tmp.toISOString());
}

function formatAxisLabel(isoDay: string, mode: "day" | "week" | "month"): string {
  const [y, m, d] = isoDay.split("-").map(Number);
  if (!y || !m) return isoDay;
  const date = new Date(y, m - 1, d || 1);
  if (mode === "month") {
    return date.toLocaleString("en-US", { month: "short", year: "2-digit" });
  }
  return date.toLocaleString("en-US", { month: "short", day: "numeric" });
}

function inRange(iso: string | null | undefined, start: string | null): boolean {
  if (!iso) return false;
  if (!start) return true;
  return iso >= start;
}

function toSummary(row: PostMetrics): TrendsPostSummary {
  return {
    id: row.post.id,
    title: row.post.title || row.post.content.slice(0, 80) || "Untitled",
    content: row.post.content,
    mediaType: row.post.mediaType,
    mediaUrl: row.post.mediaUrl,
    mediaTitle: row.post.mediaTitle,
    firstComment: row.post.firstComment,
    secondComment: row.post.secondComment,
    thirdComment: row.post.thirdComment,
    topics: row.post.topics,
    publishedAt: row.post.publishedAt,
    impressions: row.impressions,
    likes: row.likes,
    comments: row.comments,
    shares: row.shares,
    saves: row.saves,
    sends: row.sends,
    reposts: row.reposts,
    organicReposts: row.organicReposts,
    engagements: row.engagements,
    engagementRate: row.engagementRate,
  };
}

export async function recordFollowerSnapshot(
  followers: number,
  source: "settings" | "publish" | "zernio" = "settings",
  capturedAt = new Date().toISOString(),
) {
  if (!Number.isFinite(followers) || followers < 0) return;
  await ensureSchema();
  const latest = await db
    .select()
    .from(followerSnapshots)
    .orderBy(desc(followerSnapshots.capturedAt))
    .limit(1)
    .get();
  // Avoid duplicate consecutive same values within ~12h for settings/zernio updates.
  if (
    latest &&
    latest.followers === followers &&
    (source === "settings" || source === "zernio") &&
    Date.now() - new Date(latest.capturedAt).getTime() < 12 * 60 * 60 * 1000
  ) {
    return;
  }
  await db.insert(followerSnapshots).values({
    id: uuid(),
    capturedAt,
    followers: Math.round(followers),
    source,
  });
}

async function loadPublishedWithMetrics(): Promise<PostMetrics[]> {
  await ensureSchema();
  const published = await db
    .select()
    .from(posts)
    .where(eq(posts.status, "published"))
    .all();

  const ownRepostCounts = new Map<string, number>();
  const jobs = await db
    .select()
    .from(automationJobs)
    .where(and(eq(automationJobs.type, "repost"), eq(automationJobs.status, "done")))
    .all();
  for (const j of jobs) {
    ownRepostCounts.set(j.postId, (ownRepostCounts.get(j.postId) ?? 0) + 1);
  }

  const out: PostMetrics[] = [];
  for (const post of published) {
    const snap = await db
      .select()
      .from(metricsSnapshots)
      .where(eq(metricsSnapshots.postId, post.id))
      .orderBy(desc(metricsSnapshots.capturedAt))
      .limit(1)
      .get();
    const impressions = snap?.impressions ?? 0;
    const likes = snap?.likes ?? 0;
    const comments = snap?.comments ?? 0;
    const shares = snap?.shares ?? 0;
    const saves = snap?.saves ?? 0;
    const sends = snap?.sends ?? 0;
    const reposts = snap?.reposts ?? shares;
    const own = ownRepostCounts.get(post.id) ?? 0;
    const organicReposts = Math.max(0, reposts - own);
    const engagements = likes + comments + shares + saves + sends;
    const engagementRate =
      computeEngagementRate({
        engagements,
        impressions,
        impressionsSource: impressionsSourceFromRaw(snap?.rawJson),
      }) ?? 0;
    out.push({
      post,
      impressions,
      likes,
      comments,
      shares,
      saves,
      sends,
      reposts,
      organicReposts,
      engagements,
      engagementRate,
    });
  }
  return out;
}

function filterByPeriod(rows: PostMetrics[], periodId: TrendsPeriodId) {
  const start = periodStartIso(periodId);
  return rows.filter((r) => inRange(r.post.publishedAt, start));
}

function seriesFromBuckets(
  buckets: Map<string, number>,
  mode: "day" | "week" | "month",
): TrendsSeriesPoint[] {
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({
      date,
      label: formatAxisLabel(date, mode),
      value,
    }));
}

function averageOf(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function buildFollowerSeries(
  snapshots: { capturedAt: string; followers: number }[],
  periodId: TrendsPeriodId,
): TrendsSeriesPoint[] {
  const start = periodStartIso(periodId);
  const filtered = snapshots.filter((s) => inRange(s.capturedAt, start));
  // Collapse to one point per day (latest that day).
  const byDay = new Map<string, number>();
  for (const s of filtered) {
    byDay.set(dayKey(s.capturedAt), s.followers);
  }
  return seriesFromBuckets(byDay, periodId === "week" ? "day" : "day");
}

function buildDailyImpressions(
  rows: PostMetrics[],
  periodId: TrendsPeriodId,
): TrendsSeriesPoint[] {
  const start = periodStartIso(periodId);
  const buckets = new Map<string, number>();
  for (const r of rows) {
    if (!inRange(r.post.publishedAt, start) || !r.post.publishedAt) continue;
    const k = dayKey(r.post.publishedAt);
    buckets.set(k, (buckets.get(k) ?? 0) + r.impressions);
  }
  return seriesFromBuckets(buckets, "day");
}

/** Prefer LinkedIn account-level daily series when imported. */
function buildDailyImpressionsFromAccount(
  days: { date: string; impressions: number }[],
  periodId: TrendsPeriodId,
): TrendsSeriesPoint[] {
  const start = periodStartIso(periodId);
  const buckets = new Map<string, number>();
  for (const d of days) {
    const iso = `${d.date}T12:00:00.000Z`;
    if (!inRange(iso, start)) continue;
    buckets.set(d.date, d.impressions);
  }
  return seriesFromBuckets(buckets, "day");
}

function buildWeeklyFromDaily(
  days: { date: string; value: number }[],
  periodId: TrendsPeriodId,
  mode: "sum" | "avg",
): TrendsSeriesPoint[] {
  const start = periodStartIso(periodId);
  const week = new Map<string, { total: number; n: number }>();
  for (const d of days) {
    const iso = `${d.date}T12:00:00.000Z`;
    if (!inRange(iso, start)) continue;
    const k = weekKey(iso);
    const cur = week.get(k) ?? { total: 0, n: 0 };
    cur.total += d.value;
    cur.n += 1;
    week.set(k, cur);
  }
  const buckets = new Map<string, number>();
  for (const [k, v] of week) {
    buckets.set(k, mode === "avg" ? (v.n > 0 ? v.total / v.n : 0) : v.total);
  }
  return seriesFromBuckets(buckets, "week");
}

function buildWeeklyEngagementFromDaily(
  days: { date: string; impressions: number; engagements: number }[],
  periodId: TrendsPeriodId,
): TrendsSeriesPoint[] {
  const start = periodStartIso(periodId);
  const week = new Map<string, { eng: number; impr: number }>();
  for (const d of days) {
    const iso = `${d.date}T12:00:00.000Z`;
    if (!inRange(iso, start)) continue;
    const k = weekKey(iso);
    const cur = week.get(k) ?? { eng: 0, impr: 0 };
    cur.eng += d.engagements;
    cur.impr += d.impressions;
    week.set(k, cur);
  }
  const buckets = new Map<string, number>();
  for (const [k, v] of week) {
    buckets.set(k, v.impr > 0 ? (v.eng / v.impr) * 100 : 0);
  }
  return seriesFromBuckets(buckets, "week");
}

function buildWeeklyAverageSeries(
  rows: PostMetrics[],
  periodId: TrendsPeriodId,
  valueOf: (r: PostMetrics) => number,
): TrendsSeriesPoint[] {
  const start = periodStartIso(periodId);
  const buckets = new Map<string, number>();
  for (const r of rows) {
    if (!inRange(r.post.publishedAt, start) || !r.post.publishedAt) continue;
    const k = weekKey(r.post.publishedAt);
    buckets.set(k, (buckets.get(k) ?? 0) + valueOf(r));
  }
  return seriesFromBuckets(buckets, "week");
}

function buildWeeklyEngagementRate(
  rows: PostMetrics[],
  periodId: TrendsPeriodId,
): TrendsSeriesPoint[] {
  const start = periodStartIso(periodId);
  const week = new Map<string, { eng: number; impr: number }>();
  for (const r of rows) {
    if (!inRange(r.post.publishedAt, start) || !r.post.publishedAt) continue;
    const k = weekKey(r.post.publishedAt);
    const cur = week.get(k) ?? { eng: 0, impr: 0 };
    cur.eng += r.engagements;
    cur.impr += r.impressions;
    week.set(k, cur);
  }
  const buckets = new Map<string, number>();
  for (const [k, v] of week) {
    buckets.set(k, v.impr > 0 ? (v.eng / v.impr) * 100 : 0);
  }
  return seriesFromBuckets(buckets, "week");
}

function topPosts(
  rows: PostMetrics[],
  periodId: TrendsPeriodId,
  metric: keyof Pick<
    PostMetrics,
    "impressions" | "engagements" | "likes" | "comments" | "saves" | "sends"
  >,
  limit: number,
): TrendsPostSummary[] {
  return filterByPeriod(rows, periodId)
    .slice()
    .sort((a, b) => b[metric] - a[metric])
    .slice(0, limit)
    .map(toSummary);
}

function topHashtags(
  rows: PostMetrics[],
  periodId: TrendsPeriodId,
  limit: number,
): TrendsHashtagRow[] {
  const map = new Map<string, { tag: string; impressions: number; posts: number }>();
  for (const r of filterByPeriod(rows, periodId)) {
    const tags = extractHashtags(r.post.content, r.post.topics ?? "[]");
    for (const tag of tags) {
      const key = normalizeHashtagKey(tag);
      if (!key) continue;
      const cur = map.get(key) ?? { tag, impressions: 0, posts: 0 };
      cur.impressions += r.impressions;
      cur.posts += 1;
      map.set(key, cur);
    }
  }
  return [...map.values()]
    .map((row) => ({
      tag: row.tag,
      posts: row.posts,
      avgImpressions:
        row.posts > 0 ? row.impressions / row.posts : 0,
    }))
    .sort((a, b) => b.avgImpressions - a.avgImpressions)
    .slice(0, limit);
}

export async function getTrendsDashboard() {
  await ensureSchema();
  const rows = await loadPublishedWithMetrics();

  const accountDays = await db
    .select()
    .from(dailyMetrics)
    .orderBy(asc(dailyMetrics.date))
    .all();
  const hasAccountDays = accountDays.length > 0;

  // Seed follower history from publish stamps + stored snapshots + current setting.
  const snaps = await db
    .select()
    .from(followerSnapshots)
    .orderBy(asc(followerSnapshots.capturedAt))
    .all();

  const fromPublish = rows
    .filter((r) => r.post.followersAtPublish != null && r.post.publishedAt)
    .map((r) => ({
      capturedAt: r.post.publishedAt!,
      followers: r.post.followersAtPublish!,
    }));

  const currentRaw = await getSetting("linkedin_followers");
  const currentFollowers = currentRaw ? Number(currentRaw) : NaN;
  const mergedFollowers = [
    ...fromPublish,
    ...snaps.map((s) => ({
      capturedAt: s.capturedAt,
      followers: s.followers,
    })),
  ];
  if (Number.isFinite(currentFollowers)) {
    mergedFollowers.push({
      capturedAt: new Date().toISOString(),
      followers: currentFollowers,
    });
  }
  mergedFollowers.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));

  const weekRows = filterByPeriod(rows, "week");
  const avgImpressionsPerWeek = hasAccountDays
    ? averageOf(
        buildWeeklyFromDaily(
          accountDays.map((d) => ({
            date: d.date,
            value: d.impressions,
          })),
          "month",
          "sum",
        ).map((p) => p.value),
      )
    : averageWeeklyImpressions(rows, "month");

  const topOfWeek = weekRows
    .slice()
    .sort(
      (a, b) =>
        b.impressions - a.impressions ||
        b.engagements - a.engagements ||
        b.likes - a.likes,
    )[0];

  const followerDeltaWeek = (() => {
    const start = periodStartIso("week");
    const inWeek = mergedFollowers.filter((s) => inRange(s.capturedAt, start));
    if (inWeek.length < 2) {
      if (!Number.isFinite(currentFollowers) || inWeek.length === 0) return null;
      return 0;
    }
    return inWeek[inWeek.length - 1]!.followers - inWeek[0]!.followers;
  })();

  const chartBundle = <T extends TrendsPeriodId>(
    ids: readonly T[],
    build: (id: T) => TrendsSeriesPoint[],
  ) => {
    const out = {} as Record<T, TrendsSeriesPoint[]>;
    for (const id of ids) out[id] = build(id);
    return out;
  };

  const leadersBundle = <T extends TrendsPeriodId>(ids: readonly T[]) => {
    const out = {} as Record<
      T,
      {
        impressions: TrendsPostSummary[];
        engagement: TrendsPostSummary[];
        likes: TrendsPostSummary[];
        comments: TrendsPostSummary[];
        saves: TrendsPostSummary[];
        sends: TrendsPostSummary[];
        hashtags: TrendsHashtagRow[];
      }
    >;
    for (const id of ids) {
      out[id] = {
        impressions: topPosts(rows, id, "impressions", 5),
        engagement: topPosts(rows, id, "engagements", 5),
        likes: topPosts(rows, id, "likes", 5),
        comments: topPosts(rows, id, "comments", 5),
        saves: topPosts(rows, id, "saves", 5),
        sends: topPosts(rows, id, "sends", 5),
        hashtags: topHashtags(rows, id, 25),
      };
    }
    return out;
  };

  return {
    widgets: {
      followers: Number.isFinite(currentFollowers) ? currentFollowers : null,
      followersDeltaWeek: followerDeltaWeek,
      avgImpressionsPerWeek,
      topPostOfWeek: topOfWeek ? toSummary(topOfWeek) : null,
    },
    charts: {
      followerGrowth: chartBundle(
        ["week", "month", "quarter", "6mo", "year", "all"] as const,
        (id) => buildFollowerSeries(mergedFollowers, id),
      ),
      dailyImpressions: chartBundle(
        ["week", "month", "quarter"] as const,
        (id) =>
          hasAccountDays
            ? buildDailyImpressionsFromAccount(accountDays, id)
            : buildDailyImpressions(rows, id),
      ),
      weeklyImpressions: chartBundle(
        ["month", "quarter", "6mo", "year", "2yr", "all"] as const,
        (id) =>
          hasAccountDays
            ? buildWeeklyFromDaily(
                accountDays.map((d) => ({
                  date: d.date,
                  value: d.impressions,
                })),
                id,
                "sum",
              )
            : buildWeeklyAverageSeries(rows, id, (r) => r.impressions),
      ),
      engagement: chartBundle(
        ["week", "month", "quarter", "6mo", "year", "2yr", "all"] as const,
        (id) =>
          hasAccountDays
            ? buildWeeklyEngagementFromDaily(accountDays, id)
            : buildWeeklyEngagementRate(rows, id),
      ),
      organicReposts: chartBundle(
        ["month", "quarter", "year", "all"] as const,
        (id) => buildWeeklyAverageSeries(rows, id, (r) => r.organicReposts),
      ),
    },
    leaders: leadersBundle([
      "week",
      "month",
      "quarter",
      "6mo",
      "year",
      "2yr",
      "all",
    ] as const),
    referencePosts: rows
      .slice()
      .sort((a, b) =>
        (b.post.publishedAt ?? "").localeCompare(a.post.publishedAt ?? ""),
      )
      .map(toSummary),
  };
}

function averageWeeklyImpressions(
  rows: PostMetrics[],
  periodId: TrendsPeriodId,
): number {
  const series = buildWeeklyAverageSeries(rows, periodId, (r) => r.impressions);
  return averageOf(series.map((p) => p.value));
}
