import "./_env";
import { randomUUID } from "node:crypto";
import { addHours } from "date-fns";
import { db, ensureSchema } from "../src/lib/db";
import {
  engageRecs,
  ideas,
  metricsSnapshots,
  posts,
  radarPosts,
  watchAccounts,
} from "../src/lib/schema";
import { setSetting } from "../src/lib/settings";

async function main() {
  await ensureSchema();
  await setSetting("niches", "AI agents, B2B content, Product ops");
  await setSetting("session_health", "unknown");

  const pubId = randomUUID();
  const scheduledId = randomUUID();
  const publishedAt = new Date();
  publishedAt.setDate(publishedAt.getDate() - 3);

  await db.insert(posts).values([
    {
      id: pubId,
      title: "How I ship LinkedIn content without living in the app",
      content:
        "Picture this:\n\nA calendar full of drafts… and zero time to babysit LinkedIn.\n\nHere's the catch: scheduling is the easy part. First comments + 12h self-reposts are where the ops debt lives.\n\n→ Build a content HQ\n→ Automate the boring parts\n→ Keep the voice human\n\nWhat's your biggest LinkedIn ops bottleneck?",
      status: "published",
      publishedAt: publishedAt.toISOString(),
      scheduledFor: publishedAt.toISOString(),
      topics: JSON.stringify(["AI agents", "Ops"]),
      firstComment: "Full stack notes: https://example.com/linkedwin",
      mediaType: "image",
      mediaUrl: "https://example.com/linkedwin-cover.png",
      followersAtPublish: 12480,
    },
    {
      id: scheduledId,
      title: "Text: Niche engagement map",
      content: "Draft scheduled for tomorrow morning.",
      status: "scheduled",
      scheduledFor: addHours(new Date(), 20).toISOString(),
      topics: JSON.stringify(["Engage"]),
    },
  ]);

  await db.insert(metricsSnapshots).values({
    id: randomUUID(),
    postId: pubId,
    impressions: 4200,
    likes: 210,
    comments: 48,
    shares: 54,
    clicks: 90,
    saves: 36,
    sends: 12,
    reposts: 54,
    engagementRate: 8.57,
  });

  await db.insert(ideas).values([
    {
      id: randomUUID(),
      body: "Build in public: LinkedWin week 1",
      topic: "Build in public",
    },
    {
      id: randomUUID(),
      body: "Document posts vs carousels experiment",
      topic: "Formats",
    },
    {
      id: randomUUID(),
      body: "Follow list for GTM creators",
      topic: "Engage",
    },
  ]);

  const watchId = randomUUID();
  await db.insert(watchAccounts).values({
    id: watchId,
    handle: "creatorA",
    displayName: "Creator A",
    niche: "AI agents",
    linkedinUrl: "https://www.linkedin.com/in/example",
  });

  await db.insert(radarPosts).values([
    {
      id: randomUUID(),
      watchAccountId: watchId,
      authorHandle: "creatorA",
      title: "How we cut CAC with content",
      url: "https://www.linkedin.com/feed/update/urn:li:activity:1",
      engagementScore: 12000,
      niche: "AI agents",
    },
    {
      id: randomUUID(),
      authorHandle: "creatorB",
      title: "The only LinkedIn KPI that matters",
      url: "https://www.linkedin.com/feed/update/urn:li:activity:2",
      engagementScore: 9400,
      niche: "B2B content",
    },
  ]);

  await db.insert(engageRecs).values([
    {
      id: randomUUID(),
      handle: "prospect1",
      postUrl: "https://www.linkedin.com/feed/update/urn:li:activity:3",
      reason: "post 2h ago — high overlap with AI agents",
      score: 92,
    },
    {
      id: randomUUID(),
      handle: "prospect2",
      postUrl: "https://www.linkedin.com/feed/update/urn:li:activity:4",
      reason: "post 5h ago — niche: B2B SaaS",
      score: 84,
    },
  ]);

  console.log("Seeded LinkedWin demo data.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
