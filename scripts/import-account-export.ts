/**
 * Import missing feed posts from a LinkedIn *Basic* account export (Rich_Media.csv).
 *
 * The Basic export has no Shares.csv; Rich_Media.csv carries captions + upload
 * timestamps for photo/video feed posts only. Emoji are lossy ("?") in the export,
 * so matching is done on normalized ASCII text + date window.
 *
 * Usage:
 *   npx tsx scripts/import-account-export.ts <Rich_Media.csv>          # dry run
 *   npx tsx scripts/import-account-export.ts <Rich_Media.csv> --apply
 */
import "./_env";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { parse } from "csv-parse/sync";
import { extractHashtags } from "../src/lib/calendar-format";
import { db, ensureSchema } from "../src/lib/db";
import { posts } from "../src/lib/schema";

const file = process.argv[2];
const apply = process.argv.includes("--apply");
if (!file) throw new Error("Pass path to Rich_Media.csv");

const RE =
  /^You uploaded a (feed photo|photo|video) on (\w+ \d{1,2}, \d{4}) at (\d{1,2}:\d{2} [AP]M) \(GMT\)$/;

function toIso(date: string, time: string): string {
  return new Date(`${date} ${time} GMT`).toISOString();
}

/** Undo the export's "?" for smart apostrophes/quotes where it's unambiguous. */
function repair(s: string): string {
  return s
    .replace(/([A-Za-z])\?(s|re|ll|t|d|ve|m)\b/g, "$1'$2")
    .replace(/(^|\s)\?([A-Za-z])/g, '$1"$2')
    .replace(/([A-Za-z.!,])\?\?(\s|$)/g, '$1?"$2');
}

/** ASCII-only lowercase words: survives the export's emoji/smart-quote mangling. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9#]+/g, " ")
    .trim();
}

function key(s: string): string {
  return norm(s).split(" ").slice(0, 12).join(" ");
}

async function main() {
  await ensureSchema();
  const rows = parse(fs.readFileSync(file, "utf8"), {
    columns: true,
    relax_quotes: true,
    skip_empty_lines: true,
  }) as Record<string, string>[];

  const candidates = rows
    .map((r) => {
      const m = RE.exec((r["Date/Time"] ?? "").trim());
      const content = repair((r["Media Description"] ?? "").trim());
      // "-" = caption-less upload (can't be matched or usefully imported)
      if (!m || content.replace(/[-\s]/g, "").length < 3) return null;
      return {
        kind: m[1] === "video" ? "video" : "image",
        // Upload time, not exact publish time (scheduled posts go live later)
        publishedAt: toIso(m[2], m[3]),
        content,
        // Media Link is a signed licdn URL that expires (~1 week) — don't persist it
        mediaUrl: null as string | null,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  const existing = await db
    .select({
      id: posts.id,
      content: posts.content,
      publishedAt: posts.publishedAt,
      scheduledFor: posts.scheduledFor,
    })
    .from(posts);

  const DAY = 86_400_000;
  const missing: typeof candidates = [];
  for (const c of candidates) {
    const k = key(c.content);
    const t = Date.parse(c.publishedAt);
    const hit = existing.find((e) => {
      const ek = key(e.content ?? "");
      if (k.length > 15 && ek.length > 15 && (ek.startsWith(k.slice(0, 60)) || k.startsWith(ek.slice(0, 60))))
        return true;
      const et = Date.parse(e.publishedAt ?? e.scheduledFor ?? "");
      // Same ~day and caption words overlap heavily (stub rows may hold partial captions)
      if (Number.isFinite(et) && Math.abs(et - t) < 1.5 * DAY) {
        const a = new Set(norm(c.content).split(" "));
        const b = norm(e.content ?? "").split(" ").filter(Boolean);
        if (b.length === 0) return false;
        const overlap = b.filter((w) => a.has(w)).length / b.length;
        return overlap > 0.6;
      }
      return false;
    });
    if (!hit) missing.push(c);
  }

  console.log(`Export media posts: ${candidates.length}; already in DB: ${candidates.length - missing.length}; missing: ${missing.length}`);
  for (const m of missing) {
    console.log(`  ${m.publishedAt}  [${m.kind}]  ${m.content.slice(0, 80).replace(/\s+/g, " ")}`);
  }
  if (!apply) {
    console.log("\nDry run. Re-run with --apply to insert.");
    return;
  }

  for (const m of missing) {
    await db.insert(posts).values({
      id: randomUUID(),
      content: m.content,
      status: "published",
      publishedAt: m.publishedAt,
      scheduledFor: m.publishedAt,
      mediaType: m.kind,
      mediaUrl: m.mediaUrl,
      topics: JSON.stringify(extractHashtags(m.content, "[]").map((h) => h.replace(/^#/, ""))),
      repostEnabled: false,
    });
  }
  console.log(`Inserted ${missing.length} posts.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
