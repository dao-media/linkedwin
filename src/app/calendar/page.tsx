import {
  CalendarClient,
} from "@/components/CalendarClient";
import type { CalendarRow } from "@/components/CalendarTable";
import type { HashtagPostSummary } from "@/components/HashtagPostsModal";
import { isCompleteStillVisible } from "@/lib/calendar-format";
import { db, ensureSchema } from "@/lib/db";
import { posts } from "@/lib/schema";
import { desc } from "drizzle-orm";

function toRow(p: typeof posts.$inferSelect): CalendarRow {
  return {
    id: p.id,
    scheduledFor: p.scheduledFor,
    publishedAt: p.publishedAt,
    title: p.title,
    content: p.content,
    status: p.status,
    topics: p.topics,
    mediaType: p.mediaType,
    mediaUrl: p.mediaUrl,
    mediaTitle: p.mediaTitle,
    firstComment: p.firstComment,
    secondComment: p.secondComment,
  };
}

function toLibrarySummary(p: typeof posts.$inferSelect): HashtagPostSummary {
  return {
    id: p.id,
    title: p.title,
    content: p.content,
    status: p.status,
    topics: p.topics,
    scheduledFor: p.scheduledFor,
    publishedAt: p.publishedAt,
  };
}

export default async function CalendarPage() {
  await ensureSchema();
  const all = await db
    .select()
    .from(posts)
    .orderBy(desc(posts.createdAt))
    .all();

  const drafts = all.filter((p) => p.status === "draft").map(toRow);

  const scheduled = all
    .filter((p) => {
      const s = p.status.toLowerCase();
      if (s === "draft") return false;
      if (s === "scheduled" || s === "failed" || s === "error") return true;
      if (s === "published") return isCompleteStillVisible(p.publishedAt);
      return false;
    })
    .sort((a, b) => {
      const aKey = a.scheduledFor ?? a.publishedAt ?? "";
      const bKey = b.scheduledFor ?? b.publishedAt ?? "";
      return bKey.localeCompare(aKey);
    })
    .map(toRow);

  const libraryPosts = all.map(toLibrarySummary);

  return (
    <CalendarClient
      scheduled={scheduled}
      drafts={drafts}
      libraryPosts={libraryPosts}
    />
  );
}
