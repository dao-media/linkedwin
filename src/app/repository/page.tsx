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
  resolveEngagementTotal,
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

    const breakdown =
      (likes ?? 0) +
      (comments ?? 0) +
      (shares ?? 0) +
      (saves ?? 0) +
      (sends ?? 0);
    const engagements = resolveEngagementTotal({
      likes,
      comments,
      shares,
      saves,
      sends,
      rawJson: snap?.rawJson,
    });
    // Hide zero reaction cells when we only have LinkedIn's aggregate total.
    const showBreakdown = breakdown > 0;

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
      firstComment: p.firstComment,
      secondComment: p.secondComment,
      thirdComment: p.thirdComment,
      impressions,
      engRate,
      engagements,
      likes: showBreakdown ? likes : null,
      comments: showBreakdown ? comments : null,
      shares: showBreakdown ? shares : null,
      saves: showBreakdown ? saves : null,
      sends: showBreakdown ? sends : null,
      reposts: showBreakdown ? reposts : null,
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
