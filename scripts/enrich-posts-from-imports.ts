/**
 * Enrich all stored posts from Favikon CSV + LinkedIn AggregateAnalytics.
 *
 * Ensures each post has:
 *  - LinkedIn post URL
 *  - Hashtags in topics (from caption)
 *  - Performance metrics (Favikon likes/comments/shares + LinkedIn impressions
 *    when available; otherwise impressions estimated from LinkedIn median eng rate)
 *
 * Usage:
 *   npx tsx scripts/enrich-posts-from-imports.ts \
 *     [favikon.csv] [linkedin.xlsx]
 */
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { parse } from "csv-parse/sync";
import { eq } from "drizzle-orm";
import * as XLSX from "xlsx";
import { extractHashtags } from "../src/lib/calendar-format";
import { db, ensureSchema } from "../src/lib/db";
import { metricsSnapshots, posts } from "../src/lib/schema";

const MONTHS: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

type FavikonRow = {
  network?: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  date?: string;
  caption?: string;
  likeCountRaw?: string;
  commentCountRaw?: string;
  viewCountRaw?: string;
  shareCountRaw?: string;
  engagementCountRaw?: string;
  engagementRateRaw?: string;
};

function parseFavikonDate(raw: string): Date | null {
  const m = raw.trim().match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const mon = MONTHS[m[2]!];
  const year = 2000 + Number(m[3]);
  if (mon == null || !Number.isFinite(day) || !Number.isFinite(year)) return null;
  return new Date(year, mon, day, 12, 0, 0, 0);
}

function parseCount(raw: string | undefined): number {
  const s = (raw ?? "").trim().replace(/\r/g, "");
  if (!s || s === "-") return 0;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

function activityIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const s = String(url);
  const m =
    s.match(/(?:activity-|share-|ugcPost-|activity:)(\d{10,})/i) ||
    s.match(/(\d{16,})/);
  return m?.[1] ?? null;
}

function stablePostId(activityId: string) {
  const hash = createHash("sha256")
    .update(`favikon:${activityId}`)
    .digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

function parseUsDate(raw: string): Date | null {
  const m = String(raw).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]), 12, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dayIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type LinkedInTop = {
  activityId: string;
  url: string;
  publishDate: string | null;
  impressions: number;
  engagements: number;
};

function parseLinkedInTopPosts(sheet: XLSX.WorkSheet): LinkedInTop[] {
  const aoa = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  }) as unknown[][];
  const byId = new Map<string, LinkedInTop>();

  for (const row of aoa) {
    if (!Array.isArray(row)) continue;
    const engUrl = row[0] != null ? String(row[0]) : "";
    const imprUrl = row[4] != null ? String(row[4]) : "";

    if (engUrl.startsWith("http")) {
      const id = activityIdFromUrl(engUrl);
      if (id) {
        const cur = byId.get(id) ?? {
          activityId: id,
          url: engUrl,
          publishDate: null,
          impressions: 0,
          engagements: 0,
        };
        cur.url = engUrl;
        cur.publishDate = row[1] != null ? String(row[1]) : cur.publishDate;
        cur.engagements = parseCount(String(row[2] ?? ""));
        byId.set(id, cur);
      }
    }
    if (imprUrl.startsWith("http")) {
      const id = activityIdFromUrl(imprUrl);
      if (id) {
        const cur = byId.get(id) ?? {
          activityId: id,
          url: imprUrl,
          publishDate: null,
          impressions: 0,
          engagements: 0,
        };
        cur.url = cur.url || imprUrl;
        cur.publishDate =
          cur.publishDate ?? (row[5] != null ? String(row[5]) : null);
        cur.impressions = parseCount(String(row[6] ?? ""));
        byId.set(id, cur);
      }
    }
  }
  return [...byId.values()];
}

async function main() {
  const favikonPath =
    process.argv[2] ??
    path.join(process.cwd(), "data/imports/favikon-posts.csv");
  const xlsxPath =
    process.argv[3] ??
    path.join(process.cwd(), "data/imports/linkedin-aggregate-analytics.xlsx");

  if (!fs.existsSync(favikonPath)) {
    throw new Error(`Favikon CSV not found: ${favikonPath}`);
  }
  if (!fs.existsSync(xlsxPath)) {
    throw new Error(`LinkedIn xlsx not found: ${xlsxPath}`);
  }

  await ensureSchema();

  const favikonRows = parse(fs.readFileSync(favikonPath, "utf8"), {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_quotes: true,
    relax_column_count: true,
  }) as FavikonRow[];

  const wb = XLSX.readFile(xlsxPath);
  const topPosts = parseLinkedInTopPosts(wb.Sheets["TOP POSTS"]);
  const topById = new Map(topPosts.map((t) => [t.activityId, t]));
  const usedTopIds = new Set<string>();

  // Median LinkedIn engagement rate for estimating missing impressions.
  const rates = topPosts
    .filter((t) => t.impressions > 0 && t.engagements > 0)
    .map((t) => t.engagements / t.impressions)
    .sort((a, b) => a - b);
  const medianRate =
    rates.length > 0 ? rates[Math.floor(rates.length / 2)]! : 0.025;

  // Pre-index LinkedIn tops by publish day for fuzzy matching.
  const topByDay = new Map<string, LinkedInTop[]>();
  for (const t of topPosts) {
    if (!t.publishDate || !t.impressions) continue;
    const td = parseUsDate(t.publishDate);
    if (!td) continue;
    const key = dayIso(td);
    const list = topByDay.get(key) ?? [];
    list.push(t);
    topByDay.set(key, list);
  }

  function claimTopForFavikon(
    activityId: string,
    published: Date,
    favikonEngagements: number,
  ): LinkedInTop | null {
    const direct = topById.get(activityId);
    if (direct?.impressions && !usedTopIds.has(direct.activityId)) {
      usedTopIds.add(direct.activityId);
      return direct;
    }

    const day = dayIso(published);
    const candidates = (topByDay.get(day) ?? []).filter(
      (t) => !usedTopIds.has(t.activityId) && t.impressions > 0,
    );
    if (candidates.length === 0) return null;

    // LinkedIn "engagements" includes saves/sends, so Favikon sums run lower —
    // pick closest on that day (unique day → take it even if delta is large).
    candidates.sort(
      (a, b) =>
        Math.abs(a.engagements - favikonEngagements) -
        Math.abs(b.engagements - favikonEngagements),
    );
    const best = candidates[0]!;
    if (
      candidates.length === 1 ||
      Math.abs(best.engagements - favikonEngagements) <=
        Math.max(120, favikonEngagements * 1.25)
    ) {
      usedTopIds.add(best.activityId);
      return best;
    }
    return null;
  }

  let upserted = 0;
  let withLinkedInImpr = 0;
  let withEstimatedImpr = 0;
  let withHashtags = 0;
  let skipped = 0;

  const allPosts = await db.select().from(posts).all();
  const byActivity = new Map<string, (typeof allPosts)[0]>();
  for (const p of allPosts) {
    const id = activityIdFromUrl(p.linkedinPostUrl);
    if (id) byActivity.set(id, p);
  }

  for (const row of favikonRows) {
    if ((row.network ?? "").toLowerCase() !== "linkedin") {
      skipped += 1;
      continue;
    }
    const postUrl = (row.mediaUrl ?? "").trim();
    const caption = (row.caption ?? "").trim();
    const activityId = activityIdFromUrl(postUrl);
    if (!activityId || !caption) {
      skipped += 1;
      continue;
    }
    const published = parseFavikonDate(row.date ?? "");
    if (!published) {
      skipped += 1;
      continue;
    }

    const publishedAt = published.toISOString();
    const id = stablePostId(activityId);
    const likes = parseCount(row.likeCountRaw);
    const comments = parseCount(row.commentCountRaw);
    const shares = parseCount(row.shareCountRaw);
    const favikonEngagements =
      parseCount(row.engagementCountRaw) || likes + comments + shares;

    const hashtags = extractHashtags(caption, "[]");
    const topics = JSON.stringify(
      hashtags.map((h) => h.replace(/^#/, "")),
    );
    if (hashtags.length) withHashtags += 1;

    const thumb = (row.thumbnailUrl ?? "").trim() || null;
    const title = caption.replace(/\s+/g, " ").slice(0, 80);

    // Prefer LinkedIn canonical URL / impressions from AggregateAnalytics.
    let linkedinPostUrl = postUrl;
    let impressions = 0;
    let impressionsSource: "linkedin_export" | "estimated" | "none" = "none";
    let linkedinEngagements: number | null = null;

    const top = claimTopForFavikon(activityId, published, favikonEngagements);
    if (top?.impressions) {
      impressions = top.impressions;
      impressionsSource = "linkedin_export";
      linkedinEngagements = top.engagements || null;
      if (top.url) linkedinPostUrl = top.url;
      withLinkedInImpr += 1;
    }

    if (impressionsSource === "none" && favikonEngagements > 0 && medianRate > 0) {
      impressions = Math.max(
        favikonEngagements,
        Math.round(favikonEngagements / medianRate),
      );
      impressionsSource = "estimated";
      withEstimatedImpr += 1;
    }

    const saves = 0;
    const sends = 0;
    const engagementsForRate =
      linkedinEngagements ?? likes + comments + shares + saves + sends;
    // Only store a real eng rate when impressions came from LinkedIn.
    // Estimated impressions use median rate → would make every post look identical.
    const engagementRate =
      impressionsSource === "linkedin_export" && impressions > 0
        ? (engagementsForRate / impressions) * 100
        : null;

    const existing =
      byActivity.get(activityId) ??
      (await db.select().from(posts).where(eq(posts.id, id)).get());

    const postId = existing?.id ?? id;
    const values = {
      title,
      content: caption,
      status: "published" as const,
      scheduledFor: publishedAt,
      publishedAt,
      mediaType: thumb ? ("image" as const) : null,
      mediaUrl: thumb,
      mediaTitle: null as string | null,
      linkedinPostUrl,
      topics,
      zernioPostId: null as string | null,
      updatedAt: new Date().toISOString(),
      followersAtPublish: existing?.followersAtPublish ?? null,
    };

    if (existing) {
      await db.update(posts).set(values).where(eq(posts.id, existing.id));
    } else {
      await db.insert(posts).values({
        id: postId,
        ...values,
        createdAt: publishedAt,
      });
    }

    await db.delete(metricsSnapshots).where(eq(metricsSnapshots.postId, postId));
    await db.insert(metricsSnapshots).values({
      id: randomUUID(),
      postId,
      capturedAt: new Date().toISOString(),
      impressions,
      likes,
      comments,
      shares,
      clicks: 0,
      saves,
      sends,
      reposts: shares,
      engagementRate,
      rawJson: JSON.stringify({
        source: "enrich_favikon_linkedin",
        activityId,
        impressionsSource,
        medianEngRateUsed:
          impressionsSource === "estimated" ? medianRate : null,
        favikon: {
          likeCountRaw: row.likeCountRaw,
          commentCountRaw: row.commentCountRaw,
          shareCountRaw: row.shareCountRaw,
          engagementCountRaw: row.engagementCountRaw,
          viewCountRaw: row.viewCountRaw,
        },
        linkedin: linkedinEngagements != null
          ? {
              engagements: linkedinEngagements,
              impressions:
                impressionsSource === "linkedin_export" ? impressions : null,
              url: linkedinPostUrl,
            }
          : null,
        hashtags,
      }),
    });

    upserted += 1;
  }

  console.log(
    JSON.stringify(
      {
        favikonPath,
        xlsxPath,
        upserted,
        skipped,
        withHashtags,
        withoutHashtags: upserted - withHashtags,
        withLinkedInImpressions: withLinkedInImpr,
        withEstimatedImpressions: withEstimatedImpr,
        medianEngRate: Number(medianRate.toFixed(5)),
        topPostsInExport: topPosts.length,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
