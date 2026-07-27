import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import {
  extractHashtags,
  normalizeHashtagKey,
} from "./calendar-format";
import { db, ensureSchema } from "./db";
import { dailyMetrics, metricsSnapshots, posts } from "./schema";
import type { DateRangeId } from "./voice";
import { DATE_RANGES } from "./voice";

function rangeStart(rangeId: DateRangeId) {
  const range = DATE_RANGES.find((r) => r.id === rangeId) ?? DATE_RANGES[0];
  if (range.days == null) return null;
  const d = new Date();
  d.setDate(d.getDate() - range.days);
  return d.toISOString();
}

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

export function parseTopics(raw: string | null | undefined): string[] {
  try {
    const v = JSON.parse(raw ?? "[]");
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

async function buildImpressionTrend(
  rangeId: DateRangeId,
  published: (typeof posts.$inferSelect)[],
  latestByPost: Map<string, { impressions: number | null }>,
): Promise<{ date: string; impressions: number }[]> {
  const start = rangeStart(rangeId);
  const startDay = start ? dayKey(start) : null;

  const accountDays = await db
    .select()
    .from(dailyMetrics)
    .orderBy(asc(dailyMetrics.date))
    .all();

  const fromAccount = accountDays
    .filter((d) => !startDay || d.date >= startDay)
    .map((d) => ({ date: d.date, impressions: d.impressions ?? 0 }));

  if (fromAccount.some((d) => d.impressions > 0)) {
    return fromAccount;
  }

  const buckets = new Map<string, number>();
  for (const p of published) {
    if (!p.publishedAt) continue;
    const day = dayKey(p.publishedAt);
    if (startDay && day < startDay) continue;
    const impr = latestByPost.get(p.id)?.impressions ?? 0;
    buckets.set(day, (buckets.get(day) ?? 0) + impr);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, impressions]) => ({ date, impressions }));
}

export async function getOverviewStats(rangeId: DateRangeId = "30d") {
  await ensureSchema();
  const start = rangeStart(rangeId);

  const published = await db
    .select()
    .from(posts)
    .where(
      start
        ? and(eq(posts.status, "published"), gte(posts.publishedAt, start))
        : eq(posts.status, "published"),
    )
    .all();

  const latestByPost = new Map<
    string,
    {
      impressions: number | null;
      likes: number | null;
      comments: number | null;
      shares: number | null;
      engagementRate: number | null;
    }
  >();

  for (const p of published) {
    const snap = await db
      .select()
      .from(metricsSnapshots)
      .where(eq(metricsSnapshots.postId, p.id))
      .orderBy(desc(metricsSnapshots.capturedAt))
      .limit(1)
      .get();
    if (snap) latestByPost.set(p.id, snap);
  }

  let impressions = 0;
  let engagements = 0;
  for (const snap of latestByPost.values()) {
    impressions += snap.impressions ?? 0;
    engagements +=
      (snap.likes ?? 0) + (snap.comments ?? 0) + (snap.shares ?? 0);
  }

  const engagementRate =
    impressions > 0 ? (engagements / impressions) * 100 : 0;

  const hashtagMap = new Map<
    string,
    { tag: string; impressions: number; posts: number }
  >();
  for (const p of published) {
    const snap = latestByPost.get(p.id);
    const impr = snap?.impressions ?? 0;
    for (const tag of extractHashtags(p.content, p.topics)) {
      const key = normalizeHashtagKey(tag);
      if (!key) continue;
      const cur = hashtagMap.get(key) ?? { tag, impressions: 0, posts: 0 };
      cur.impressions += impr;
      cur.posts += 1;
      hashtagMap.set(key, cur);
    }
  }

  const topHashtags = [...hashtagMap.values()]
    .map((row) => ({
      tag: row.tag,
      posts: row.posts,
      avgImpressions: row.posts > 0 ? row.impressions / row.posts : 0,
    }))
    .sort((a, b) => b.avgImpressions - a.avgImpressions)
    .slice(0, 25);

  const recent = published
    .slice()
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .slice(0, 10)
    .map((p) => {
      const snap = latestByPost.get(p.id);
      return {
        id: p.id,
        title: p.title || p.content.slice(0, 80),
        publishedAt: p.publishedAt,
        impressions: snap?.impressions ?? 0,
        engagement:
          (snap?.likes ?? 0) + (snap?.comments ?? 0) + (snap?.shares ?? 0),
        topics: parseTopics(p.topics),
      };
    });

  const scheduledCount = await db
    .select({ c: sql<number>`count(*)` })
    .from(posts)
    .where(eq(posts.status, "scheduled"))
    .get();

  const impressionTrend = await buildImpressionTrend(
    rangeId,
    published,
    latestByPost,
  );

  return {
    impressions,
    engagementRate,
    postsPublished: published.length,
    scheduledCount: Number(scheduledCount?.c ?? 0),
    topHashtags,
    recent,
    impressionTrend,
  };
}

export async function getTopicTrends(rangeId: DateRangeId = "30d") {
  await ensureSchema();
  const start = rangeStart(rangeId);
  const published = await db
    .select()
    .from(posts)
    .where(
      start
        ? and(eq(posts.status, "published"), gte(posts.publishedAt, start))
        : eq(posts.status, "published"),
    )
    .all();

  const map = new Map<
    string,
    { posts: number; impressions: number; engagements: number }
  >();

  for (const p of published) {
    const snap = await db
      .select()
      .from(metricsSnapshots)
      .where(eq(metricsSnapshots.postId, p.id))
      .orderBy(desc(metricsSnapshots.capturedAt))
      .limit(1)
      .get();
    const impr = snap?.impressions ?? 0;
    const eng =
      (snap?.likes ?? 0) + (snap?.comments ?? 0) + (snap?.shares ?? 0);
    for (const t of parseTopics(p.topics)) {
      const cur = map.get(t) ?? { posts: 0, impressions: 0, engagements: 0 };
      cur.posts += 1;
      cur.impressions += impr;
      cur.engagements += eng;
      map.set(t, cur);
    }
  }

  return [...map.entries()]
    .map(([name, v]) => ({
      name,
      posts: v.posts,
      impressions: v.impressions,
      avgEngagementRate:
        v.impressions > 0 ? (v.engagements / v.impressions) * 100 : 0,
    }))
    .sort((a, b) => b.impressions - a.impressions);
}
