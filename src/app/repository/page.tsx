import { desc, eq } from "drizzle-orm";
import { AppShell } from "@/components/AppShell";
import {
  ContentLibraryView,
  type ContentLibraryRow,
} from "@/components/ContentLibraryTable";
import { formatHashtagLabel } from "@/lib/calendar-format";
import { db, ensureSchema } from "@/lib/db";
import {
  computeEngagementRate,
  impressionsSourceFromRaw,
} from "@/lib/metrics";
import { metricsSnapshots, posts } from "@/lib/schema";

type SearchParams = Promise<{ post?: string; tag?: string }>;

export default async function RepositoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await ensureSchema();
  const sp = await searchParams;
  const highlightId = sp.post ?? null;
  const highlightTag = sp.tag ? formatHashtagLabel(sp.tag) : null;

  const all = await db.select().from(posts).orderBy(desc(posts.createdAt)).all();

  const rows: ContentLibraryRow[] = [];
  for (const p of all) {
    const snap = await db
      .select()
      .from(metricsSnapshots)
      .where(eq(metricsSnapshots.postId, p.id))
      .orderBy(desc(metricsSnapshots.capturedAt))
      .limit(1)
      .get();

    const likes = snap?.likes ?? null;
    const comments = snap?.comments ?? null;
    const shares = snap?.shares ?? null;
    const saves = snap?.saves ?? null;
    const sends = snap?.sends ?? null;
    const reposts = snap?.reposts ?? shares;
    const impressions = snap?.impressions ?? null;

    const engagements =
      likes == null &&
      comments == null &&
      shares == null &&
      saves == null &&
      sends == null
        ? null
        : (likes ?? 0) +
          (comments ?? 0) +
          (shares ?? 0) +
          (saves ?? 0) +
          (sends ?? 0);

    const engRate = computeEngagementRate({
      engagements,
      impressions,
      impressionsSource: impressionsSourceFromRaw(snap?.rawJson),
    });

    rows.push({
      id: p.id,
      title: p.title,
      content: p.content,
      status: p.status,
      publishedAt: p.publishedAt,
      scheduledFor: p.scheduledFor,
      createdAt: p.createdAt,
      mediaType: p.mediaType,
      mediaUrl: p.mediaUrl,
      mediaTitle: p.mediaTitle ?? null,
      linkedinPostUrl: p.linkedinPostUrl ?? null,
      topics: p.topics,
      impressions,
      engRate,
      engagements,
      likes,
      comments,
      shares,
      saves,
      sends,
      reposts,
      followersAtPublish: p.followersAtPublish ?? null,
    });
  }

  // Prefer publish/schedule date descending for library browsing
  rows.sort((a, b) => {
    const aKey = a.publishedAt || a.scheduledFor || a.createdAt || "";
    const bKey = b.publishedAt || b.scheduledFor || b.createdAt || "";
    return bKey.localeCompare(aKey);
  });

  return (
    <AppShell active="/repository" title="Content Library">
      <ContentLibraryView
        rows={rows}
        highlightId={highlightId}
        highlightTag={highlightTag}
      />
    </AppShell>
  );
}
