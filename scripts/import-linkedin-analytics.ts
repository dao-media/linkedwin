import path from "node:path";
import { randomUUID } from "node:crypto";
import { eq, like, sql } from "drizzle-orm";
import * as XLSX from "xlsx";
import { db, ensureSchema } from "../src/lib/db";
import {
  dailyMetrics,
  followerSnapshots,
  metricsSnapshots,
  posts,
} from "../src/lib/schema";
import { setSetting } from "../src/lib/settings";

/**
 * Import LinkedIn AggregateAnalytics export.
 *
 * - ENGAGEMENT sheet → daily_metrics (fills Trends daily/weekly charts)
 * - FOLLOWERS sheet → follower_snapshots (fills growth chart)
 * - TOP POSTS → overlays impressions onto matched Favikon/local posts
 * - Clears fake favikon:* zernio ids so Zernio owns only real posts going forward
 *
 * Usage:
 *   npx tsx scripts/import-linkedin-analytics.ts [path/to.xlsx]
 */

function parseUsDate(raw: string): Date | null {
  const m = String(raw).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const month = Number(m[1]) - 1;
  const day = Number(m[2]);
  const year = Number(m[3]);
  const d = new Date(year, month, day, 12, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dayIso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseNum(raw: unknown): number {
  if (raw == null) return 0;
  const n = Number(String(raw).replace(/,/g, "").trim());
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

type TopPost = {
  activityId: string;
  url: string;
  publishDate: string | null;
  impressions: number;
  engagements: number;
};

function parseTopPosts(sheet: XLSX.WorkSheet): TopPost[] {
  const aoa = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  }) as unknown[][];
  const byId = new Map<string, TopPost>();

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
        cur.publishDate =
          row[1] != null ? String(row[1]) : cur.publishDate;
        cur.engagements = parseNum(row[2]);
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
        cur.impressions = parseNum(row[6]);
        byId.set(id, cur);
      }
    }
  }

  return [...byId.values()];
}

async function main() {
  const xlsxPath =
    process.argv[2] ??
    path.join(
      process.cwd(),
      "data/imports/linkedin-aggregate-analytics.xlsx",
    );

  const wb = XLSX.readFile(xlsxPath);
  await ensureSchema();

  // --- Daily ENGAGEMENT → daily_metrics ---
  const engSheet = wb.Sheets.ENGAGEMENT;
  if (!engSheet) throw new Error("Missing ENGAGEMENT sheet");
  const engRows = XLSX.utils.sheet_to_json(engSheet, {
    defval: null,
  }) as Record<string, unknown>[];

  await db.delete(dailyMetrics).where(eq(dailyMetrics.source, "linkedin_export"));

  let dailyInserted = 0;
  const dailyByDate = new Map<
    string,
    { impressions: number; engagements: number; newFollowers: number }
  >();

  for (const row of engRows) {
    const d = parseUsDate(String(row.Date ?? ""));
    if (!d) continue;
    const key = dayIso(d);
    dailyByDate.set(key, {
      impressions: parseNum(row.Impressions),
      engagements: parseNum(row.Engagements),
      newFollowers: 0,
    });
  }

  // --- FOLLOWERS sheet ---
  const follSheet = wb.Sheets.FOLLOWERS;
  if (!follSheet) throw new Error("Missing FOLLOWERS sheet");
  const follAoa = XLSX.utils.sheet_to_json(follSheet, {
    header: 1,
    defval: null,
  }) as unknown[][];

  let endTotal: number | null = null;
  let dataStart = -1;
  for (let i = 0; i < follAoa.length; i++) {
    const row = follAoa[i];
    if (!Array.isArray(row)) continue;
    const a = row[0] != null ? String(row[0]) : "";
    const b = row[1];
    if (a.toLowerCase().includes("total followers")) {
      endTotal = parseNum(b);
    }
    if (a === "Date" && String(b).toLowerCase().includes("new")) {
      dataStart = i + 1;
      break;
    }
  }
  if (endTotal == null) {
    // Alternate layout: first cell is total, second is label
    const first = follAoa[0];
    if (Array.isArray(first)) {
      const n = parseNum(first[0]);
      if (n > 0) endTotal = n;
      else endTotal = parseNum(first[1]);
    }
  }
  if (endTotal == null) throw new Error("Could not read total followers");

  const newByDate: { date: string; neu: number }[] = [];
  for (let i = dataStart >= 0 ? dataStart : 0; i < follAoa.length; i++) {
    const row = follAoa[i];
    if (!Array.isArray(row)) continue;
    const d = parseUsDate(String(row[0] ?? ""));
    if (!d) continue;
    newByDate.push({ date: dayIso(d), neu: parseNum(row[1]) });
  }

  for (const { date, neu } of newByDate) {
    const cur = dailyByDate.get(date) ?? {
      impressions: 0,
      engagements: 0,
      newFollowers: 0,
    };
    cur.newFollowers = neu;
    dailyByDate.set(date, cur);
  }

  for (const [date, v] of [...dailyByDate.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    await db.insert(dailyMetrics).values({
      id: randomUUID(),
      date,
      impressions: v.impressions,
      engagements: v.engagements,
      newFollowers: v.newFollowers,
      source: "linkedin_export",
      capturedAt: new Date().toISOString(),
    });
    dailyInserted += 1;
  }

  // Reconstruct cumulative followers (end total on last day).
  const orderedDates = [...dailyByDate.keys()].sort();
  const sumNew = orderedDates.reduce(
    (acc, d) => acc + (dailyByDate.get(d)?.newFollowers ?? 0),
    0,
  );
  let running = endTotal - sumNew;

  await db
    .delete(followerSnapshots)
    .where(eq(followerSnapshots.source, "linkedin_export"));

  let followerPoints = 0;
  for (const date of orderedDates) {
    running += dailyByDate.get(date)?.newFollowers ?? 0;
    await db.insert(followerSnapshots).values({
      id: randomUUID(),
      capturedAt: `${date}T16:00:00.000Z`,
      followers: running,
      source: "linkedin_export",
    });
    followerPoints += 1;
  }

  await setSetting("linkedin_followers", String(endTotal));
  await setSetting(
    "analytics_handoff_at",
    // Everything before local "today" is historical; Zernio owns from today.
    new Date().toISOString().slice(0, 10) + "T00:00:00.000Z",
  );
  await setSetting("linkedin_analytics_imported_at", new Date().toISOString());

  // --- Clear fake Zernio IDs on historical imports ---
  await db
    .update(posts)
    .set({ zernioPostId: null, updatedAt: new Date().toISOString() })
    .where(like(posts.zernioPostId, "favikon:%"));

  const { getSetting } = await import("../src/lib/settings");
  const handoffAt = await getSetting("analytics_handoff_at");

  // --- TOP POSTS → overlay impressions ---
  const top = parseTopPosts(wb.Sheets["TOP POSTS"]);
  const allPosts = await db.select().from(posts).all();
  const byActivity = new Map<string, (typeof allPosts)[0]>();
  for (const p of allPosts) {
    const fromUrl = activityIdFromUrl(p.linkedinPostUrl);
    if (fromUrl) byActivity.set(fromUrl, p);
    // legacy favikon id still in memory before clear — also match content urls
  }

  let postsUpdated = 0;
  let unmatched = 0;

  for (const tp of top) {
    let post = byActivity.get(tp.activityId) ?? null;

    // Fallback: same calendar day + closest Favikon engagement count
    if (!post && tp.publishDate) {
      const d = parseUsDate(tp.publishDate);
      if (d) {
        const key = dayIso(d);
        const candidates = allPosts.filter(
          (p) => p.publishedAt && dayIso(new Date(p.publishedAt)) === key,
        );
        if (candidates.length === 1) {
          post = candidates[0]!;
        } else if (candidates.length > 1 && tp.engagements > 0) {
          // Prefer candidate whose latest likes+comments+shares ~ LinkedIn engagements
          let best: (typeof candidates)[0] | null = null;
          let bestDelta = Infinity;
          for (const c of candidates) {
            const snap = await db
              .select()
              .from(metricsSnapshots)
              .where(eq(metricsSnapshots.postId, c.id))
              .orderBy(sql`captured_at desc`)
              .limit(1)
              .get();
            const eng =
              (snap?.likes ?? 0) +
              (snap?.comments ?? 0) +
              (snap?.shares ?? 0) +
              (snap?.saves ?? 0) +
              (snap?.sends ?? 0);
            const delta = Math.abs(eng - tp.engagements);
            if (delta < bestDelta) {
              bestDelta = delta;
              best = c;
            }
          }
          if (best && bestDelta <= Math.max(40, tp.engagements * 0.35)) {
            post = best;
          }
        }
      }
    }

    if (!post) {
      unmatched += 1;
      continue;
    }

    const existing = await db
      .select()
      .from(metricsSnapshots)
      .where(eq(metricsSnapshots.postId, post.id))
      .orderBy(sql`captured_at desc`)
      .limit(1)
      .get();

    const likes = existing?.likes ?? 0;
    const comments = existing?.comments ?? 0;
    const shares = existing?.shares ?? 0;
    const saves = existing?.saves ?? 0;
    const sends = existing?.sends ?? 0;
    const impressions = tp.impressions;
    const engagements =
      tp.engagements || likes + comments + shares + saves + sends;
    const engagementRate =
      impressions > 0 ? (engagements / impressions) * 100 : 0;

    await db.delete(metricsSnapshots).where(eq(metricsSnapshots.postId, post.id));
    await db.insert(metricsSnapshots).values({
      id: randomUUID(),
      postId: post.id,
      capturedAt: new Date().toISOString(),
      impressions,
      likes,
      comments,
      shares,
      clicks: existing?.clicks ?? 0,
      saves,
      sends,
      reposts: existing?.reposts ?? shares,
      engagementRate,
      rawJson: JSON.stringify({
        source: "linkedin_export",
        activityId: tp.activityId,
        linkedinUrl: tp.url,
        linkedinEngagements: tp.engagements,
        linkedinImpressions: tp.impressions,
        prior: existing
          ? {
              source: (() => {
                try {
                  return JSON.parse(existing.rawJson ?? "{}").source;
                } catch {
                  return null;
                }
              })(),
              likes,
              comments,
              shares,
            }
          : null,
      }),
    });

    // Prefer LinkedIn canonical post URL when we matched.
    if (tp.url && post.linkedinPostUrl !== tp.url) {
      await db
        .update(posts)
        .set({
          linkedinPostUrl: tp.url,
          zernioPostId: null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(posts.id, post.id));
    }

    postsUpdated += 1;
  }

  // Ensure all remaining favikon zernio ids cleared (already done) and set
  // followers at publish from nearest follower snapshot where missing.
  const snaps = await db
    .select()
    .from(followerSnapshots)
    .where(eq(followerSnapshots.source, "linkedin_export"))
    .all();
  snaps.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));

  let followersBackfilled = 0;
  for (const p of allPosts) {
    if (p.followersAtPublish != null || !p.publishedAt) continue;
    const pub = p.publishedAt.slice(0, 10);
    let nearest = snaps[0];
    for (const s of snaps) {
      if (s.capturedAt.slice(0, 10) <= pub) nearest = s;
      else break;
    }
    if (nearest) {
      await db
        .update(posts)
        .set({ followersAtPublish: nearest.followers })
        .where(eq(posts.id, p.id));
      followersBackfilled += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        xlsxPath,
        dailyInserted,
        followerPoints,
        endFollowers: endTotal,
        startFollowers: endTotal - sumNew,
        topPostsInExport: top.length,
        postsUpdatedWithImpressions: postsUpdated,
        topPostsUnmatched: unmatched,
        followersBackfilled,
        favikonZernioIdsCleared: true,
        analyticsHandoffAt: handoffAt,
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
