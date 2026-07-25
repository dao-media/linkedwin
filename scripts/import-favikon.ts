/**
 * Import Favikon CRM Creator posts CSV into LinkedWin.
 *
 * Usage:
 *   npx tsx scripts/import-favikon.ts "/path/to/Favikon - CRM Creator posts.csv"
 */
import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { eq } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
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
  username?: string;
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
  const s = (raw ?? "").trim();
  if (!s || s === "-") return 0;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

function activityIdFromUrl(url: string): string | null {
  const m = url.match(/urn:li:activity:(\d+)/i);
  return m?.[1] ?? null;
}

function stablePostId(activityId: string) {
  const hash = createHash("sha256").update(`favikon:${activityId}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

async function main() {
  const csvPath =
    process.argv[2] ??
    path.join(
      process.env.HOME ?? "",
      "Downloads/Favikon - CRM Creator posts (48).csv",
    );
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV not found: ${csvPath}`);
  }

  const raw = fs.readFileSync(csvPath, "utf8");
  const records = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_quotes: true,
    relax_column_count: true,
  }) as FavikonRow[];

  await ensureSchema();

  let imported = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of records) {
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
    const impressions = parseCount(row.viewCountRaw);
    const engagements =
      parseCount(row.engagementCountRaw) || likes + comments + shares;
    const engagementRate =
      impressions > 0 ? (engagements / impressions) * 100 : 0;

    const hashtags = extractHashtags(caption, "[]");
    const topics = JSON.stringify(
      hashtags.map((h) => h.replace(/^#/, "")),
    );
    const thumb = (row.thumbnailUrl ?? "").trim() || null;
    const title = caption.replace(/\s+/g, " ").slice(0, 80);

    const existing = await db
      .select()
      .from(posts)
      .where(eq(posts.id, id))
      .get();

    const values = {
      title,
      content: caption,
      status: "published" as const,
      scheduledFor: publishedAt,
      publishedAt,
      mediaType: thumb ? ("image" as const) : null,
      mediaUrl: thumb,
      mediaTitle: null as string | null,
      linkedinPostUrl: postUrl,
      topics,
      updatedAt: new Date().toISOString(),
      // Keep out of Zernio sync — historical import only.
      zernioPostId: null as string | null,
    };

    if (existing) {
      await db.update(posts).set(values).where(eq(posts.id, id));
      updated += 1;
    } else {
      await db.insert(posts).values({
        id,
        ...values,
        createdAt: publishedAt,
      });
      imported += 1;
    }

    // Replace latest snapshot for this imported post (one row is enough).
    await db.delete(metricsSnapshots).where(eq(metricsSnapshots.postId, id));
    await db.insert(metricsSnapshots).values({
      id: randomUUID(),
      postId: id,
      capturedAt: publishedAt,
      impressions,
      likes,
      comments,
      shares,
      clicks: 0,
      saves: 0,
      sends: 0,
      reposts: shares,
      engagementRate,
      rawJson: JSON.stringify({
        source: "favikon",
        activityId,
        engagementCountRaw: row.engagementCountRaw,
        viewCountRaw: row.viewCountRaw,
        engagementRateRaw: row.engagementRateRaw,
      }),
    });
  }

  console.log(
    JSON.stringify(
      {
        csvPath,
        rows: records.length,
        imported,
        updated,
        skipped,
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
