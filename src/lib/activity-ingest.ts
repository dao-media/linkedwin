/**
 * Upsert posts scraped from the LinkedIn "Posts" activity tab.
 *
 * Dedupe order: activity id in linkedin_post_url → Favikon stable id →
 * caption match within ±2 days (catches lossy export/stub rows with no URL).
 */
import { createHash, randomUUID } from "node:crypto";
import { extractHashtags } from "./calendar-format";
import { db, ensureSchema } from "./db";
import { metricsSnapshots, posts } from "./schema";
import { desc, eq } from "drizzle-orm";

export type ScrapedActivity = {
  activityId: string;
  content: string;
  mediaType: "image" | "video" | "document" | null;
  mediaUrl: string | null;
  metrics?: { impressions: number; reactions: number; comments: number; reposts: number } | null;
};

export type IngestResult = {
  seen: number;
  inserted: string[];
  upgraded: string[];
  unchanged: number;
  /** Metric snapshots written (only when numbers changed). */
  metrics: number;
};

async function recordMetrics(postId: string, m: NonNullable<ScrapedActivity["metrics"]>) {
  const latest = await db
    .select()
    .from(metricsSnapshots)
    .where(eq(metricsSnapshots.postId, postId))
    .orderBy(desc(metricsSnapshots.capturedAt))
    .limit(1)
    .get();
  if (
    latest &&
    latest.impressions === m.impressions &&
    latest.likes === m.reactions &&
    latest.comments === m.comments &&
    latest.reposts === m.reposts
  ) {
    return false;
  }
  await db.insert(metricsSnapshots).values({
    id: randomUUID(),
    postId,
    impressions: m.impressions,
    likes: m.reactions,
    comments: m.comments,
    reposts: m.reposts,
    shares: m.reposts,
    engagementRate: m.impressions > 0 ? ((m.reactions + m.comments + m.reposts) / m.impressions) * 100 : 0,
    rawJson: JSON.stringify({ source: "linkedin_activity", ...m }),
  });
  return true;
}

/** LinkedIn activity ids embed a ms timestamp in their top 41 bits. */
export function activityTimestamp(activityId: string): string {
  return new Date(Number(BigInt(activityId) >> BigInt(22))).toISOString();
}

export function activityUrl(activityId: string) {
  return `https://www.linkedin.com/feed/update/urn:li:activity:${activityId}/`;
}

function favikonId(activityId: string) {
  const h = createHash("sha256").update(`favikon:${activityId}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9#]+/g, " ").trim();
}

function captionsMatch(a: string, b: string) {
  const na = norm(a);
  const nb = norm(b);
  if (na.length < 15 || nb.length < 15) return false;
  const pa = na.slice(0, 60);
  const pb = nb.slice(0, 60);
  if (na.startsWith(pb) || nb.startsWith(pa)) return true;
  // Content words only, overlap required in BOTH directions (short captions mustn't match long ones)
  const sig = (s: string) => new Set(s.split(" ").filter((w) => w.length > 3));
  const wa = sig(na);
  const wb = sig(nb);
  if (wa.size < 4 || wb.size < 4) return false;
  const shared = [...wb].filter((w) => wa.has(w)).length;
  return shared / wa.size > 0.6 && shared / wb.size > 0.6;
}

// Only activity ids identify the scraped post; /posts/…-share-<id> URLs carry a different (share/ugcPost) id
const ID_IN_URL = /activity[:-](\d{19})/;

export async function ingestActivities(
  items: ScrapedActivity[],
  opts: { dryRun?: boolean } = {},
): Promise<IngestResult> {
  await ensureSchema();
  const result: IngestResult = { seen: items.length, inserted: [], upgraded: [], unchanged: 0, metrics: 0 };
  if (items.length === 0) return result;

  const existing = await db
    .select({
      id: posts.id,
      content: posts.content,
      publishedAt: posts.publishedAt,
      scheduledFor: posts.scheduledFor,
      status: posts.status,
      linkedinPostUrl: posts.linkedinPostUrl,
      mediaUrl: posts.mediaUrl,
      mediaType: posts.mediaType,
    })
    .from(posts);

  const byActivity = new Map<string, (typeof existing)[number]>();
  for (const e of existing) {
    const m = e.linkedinPostUrl ? ID_IN_URL.exec(e.linkedinPostUrl) : null;
    if (m) byActivity.set(m[1], e);
  }
  const byId = new Map(existing.map((e) => [e.id, e]));
  const DAY = 86_400_000;
  const claimed = new Set<string>();
  const now = new Date().toISOString();

  for (const item of items) {
    const publishedAt = activityTimestamp(item.activityId);
    const t = Date.parse(publishedAt);
    const match =
      byActivity.get(item.activityId) ??
      byId.get(favikonId(item.activityId)) ??
      existing.find((e) => {
        if (claimed.has(e.id)) return false;
        if (e.linkedinPostUrl && ID_IN_URL.test(e.linkedinPostUrl)) return false;
        const et = Date.parse(e.publishedAt ?? e.scheduledFor ?? "");
        // Planned posts often go out a few days off-plan; published rows must line up closely
        const window = e.status === "published" ? 2 * DAY : 7 * DAY;
        return Number.isFinite(et) && Math.abs(et - t) < window && captionsMatch(item.content, e.content ?? "");
      });

    if (match) claimed.add(match.id);
    const label = `${publishedAt.slice(0, 10)} ${item.content.slice(0, 60).replace(/\s+/g, " ")}`;

    if (!match) {
      result.inserted.push(label);
      if (opts.dryRun) continue;
      const row = {
        id: randomUUID(),
        content: item.content,
        status: "published",
        publishedAt,
        scheduledFor: publishedAt,
        linkedinPostUrl: activityUrl(item.activityId),
        mediaType: item.mediaType,
        mediaUrl: item.mediaUrl,
        topics: JSON.stringify(extractHashtags(item.content, "[]").map((h) => h.replace(/^#/, ""))),
        repostEnabled: false,
        createdAt: now,
        updatedAt: now,
      };
      await db.insert(posts).values(row);
      existing.push({ ...row });
      byActivity.set(item.activityId, row);
      if (item.metrics && (await recordMetrics(row.id, item.metrics))) result.metrics += 1;
      continue;
    }

    if (!opts.dryRun && item.metrics && (await recordMetrics(match.id, item.metrics))) result.metrics += 1;

    // No URL = a planned/draft post you've now published, or a lossy import row:
    // adopt the live caption, exact time and URL, and mark it published.
    const lossy = !match.linkedinPostUrl;
    const fillMedia = !match.mediaUrl && item.mediaUrl;
    if (!lossy && !fillMedia) {
      result.unchanged += 1;
      continue;
    }
    result.upgraded.push(label);
    if (opts.dryRun) continue;
    await db
      .update(posts)
      .set({
        ...(lossy
          ? {
              content: item.content,
              status: "published",
              publishedAt,
              linkedinPostUrl: activityUrl(item.activityId),
              topics: JSON.stringify(extractHashtags(item.content, "[]").map((h) => h.replace(/^#/, ""))),
            }
          : {}),
        ...(fillMedia ? { mediaUrl: item.mediaUrl, mediaType: item.mediaType ?? match.mediaType } : {}),
        updatedAt: now,
      })
      .where(eq(posts.id, match.id));
    byActivity.set(item.activityId, match);
  }

  return result;
}
