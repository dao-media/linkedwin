import { and, asc, desc, eq, lte } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  canExecuteBrowserJobs,
  isRetryableJobError,
} from "@/lib/automation";
import { db, ensureSchema } from "@/lib/db";
import { automationJobs, metricsSnapshots, posts } from "@/lib/schema";
import { getSetting, setSetting } from "@/lib/settings";
import { recordFollowerSnapshot } from "@/lib/trends";
import { getZernioPost, getZernioPostAnalytics } from "@/lib/zernio";

export type JobResult = {
  processed: number;
  done: string[];
  failed: { id: string; error: string }[];
  deferred: string[];
};

async function markPublishedIfReady(postId: string) {
  const post = await db.select().from(posts).where(eq(posts.id, postId)).get();
  if (!post?.zernioPostId || post.zernioPostId.startsWith("favikon:")) {
    return post;
  }
  try {
    const remote = await getZernioPost(post.zernioPostId);
    const status =
      remote?.post?.status ??
      remote?.status ??
      remote?.post?.platforms?.[0]?.status;
    const url =
      remote?.post?.platforms?.[0]?.platformPostUrl ??
      remote?.post?.platformPostUrl ??
      null;
    if (status === "published" || status === "posted" || url) {
      const followersRaw = await getSetting("linkedin_followers");
      const followersParsed = followersRaw ? Number(followersRaw) : NaN;
      const followersAtPublish =
        post.followersAtPublish ??
        (Number.isFinite(followersParsed) ? followersParsed : null);
      await db
        .update(posts)
        .set({
          status: "published",
          publishedAt: post.publishedAt ?? new Date().toISOString(),
          linkedinPostUrl: url ?? post.linkedinPostUrl,
          followersAtPublish,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(posts.id, postId));
      if (followersAtPublish != null && post.followersAtPublish == null) {
        await recordFollowerSnapshot(
          followersAtPublish,
          "publish",
          post.publishedAt ?? new Date().toISOString(),
        );
      }
    }
  } catch {
    // ignore remote lookup failures
  }
  return db.select().from(posts).where(eq(posts.id, postId)).get();
}

async function runRepost(postId: string) {
  const { parseStoredLinkedInSession } = await import(
    "@/lib/linkedin-session"
  );
  const session = parseStoredLinkedInSession(
    await getSetting("linkedin_session"),
  );
  const health = (await getSetting("session_health")) ?? "unknown";
  if (!session || health === "expired") {
    await setSetting("session_health", "expired");
    throw new Error(
      "LinkedIn browser session missing/expired — reconnect in Settings",
    );
  }

  const post = await db.select().from(posts).where(eq(posts.id, postId)).get();
  if (!post?.linkedinPostUrl) {
    throw new Error("No LinkedIn URL available for repost yet");
  }

  const { executeLinkedInRepost } = await import(
    "../../worker/linkedin-browser"
  );
  await executeLinkedInRepost({
    postId,
    url: post.linkedinPostUrl,
  });
}

async function runSecondComment(postId: string) {
  await runQueuedComment(postId, "second");
}

async function runThirdComment(postId: string) {
  await runQueuedComment(postId, "third");
}

async function runQueuedComment(postId: string, which: "second" | "third") {
  const post = await db.select().from(posts).where(eq(posts.id, postId)).get();
  const comment =
    which === "second" ? post?.secondComment : post?.thirdComment;
  if (!comment) return;
  if (!post?.linkedinPostUrl) {
    throw new Error(
      `Post not published yet — cannot add ${which} comment`,
    );
  }
  const { parseStoredLinkedInSession } = await import(
    "@/lib/linkedin-session"
  );
  const session = parseStoredLinkedInSession(
    await getSetting("linkedin_session"),
  );
  const health = (await getSetting("session_health")) ?? "unknown";
  if (!session || health === "expired") {
    await setSetting("session_health", "expired");
    throw new Error(
      "LinkedIn browser session missing/expired — reconnect in Settings",
    );
  }
  const { executeLinkedInComment } = await import(
    "../../worker/linkedin-browser"
  );
  await executeLinkedInComment({
    url: post.linkedinPostUrl,
    comment,
  });
}

function deferMs(attempts: number) {
  const mins = Math.min(30, [2, 5, 15, 30][Math.min(attempts, 3)] ?? 30);
  return mins * 60 * 1000;
}

export async function processDueJobs(limit = 10): Promise<JobResult> {
  await ensureSchema();
  const now = new Date().toISOString();
  const browserOk = canExecuteBrowserJobs();
  const due = await db
    .select()
    .from(automationJobs)
    .where(
      and(eq(automationJobs.status, "pending"), lte(automationJobs.runAt, now)),
    )
    .orderBy(asc(automationJobs.runAt))
    .limit(limit)
    .all();

  const done: string[] = [];
  const failed: { id: string; error: string }[] = [];
  const deferred: string[] = [];

  for (const job of due) {
    const needsBrowser =
      job.type === "repost" ||
      job.type === "second_comment" ||
      job.type === "third_comment";

    if (needsBrowser && !browserOk) {
      // Leave pending for the local/Fly Playwright worker.
      deferred.push(job.id);
      continue;
    }

    await db
      .update(automationJobs)
      .set({
        status: "running",
        attempts: (job.attempts ?? 0) + 1,
      })
      .where(eq(automationJobs.id, job.id));

    try {
      await markPublishedIfReady(job.postId);
      if (job.type === "repost") {
        await runRepost(job.postId);
      } else if (job.type === "second_comment") {
        await runSecondComment(job.postId);
      } else if (job.type === "third_comment") {
        await runThirdComment(job.postId);
      } else if (job.type === "metrics_sync") {
        await syncMetricsForPost(job.postId);
      }
      await db
        .update(automationJobs)
        .set({
          status: "done",
          completedAt: new Date().toISOString(),
          lastError: null,
        })
        .where(eq(automationJobs.id, job.id));
      done.push(job.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      const attempts = (job.attempts ?? 0) + 1;

      if (isRetryableJobError(message) && attempts < 8) {
        const nextRun = new Date(Date.now() + deferMs(attempts)).toISOString();
        await db
          .update(automationJobs)
          .set({
            status: "pending",
            runAt: nextRun,
            lastError: `${message} (retry at ${nextRun})`,
            completedAt: null,
          })
          .where(eq(automationJobs.id, job.id));
        deferred.push(job.id);
        continue;
      }

      await db
        .update(automationJobs)
        .set({
          status: "failed",
          lastError: message,
          completedAt: new Date().toISOString(),
        })
        .where(eq(automationJobs.id, job.id));
      failed.push({ id: job.id, error: message });
    }
  }

  return { processed: due.length, done, failed, deferred };
}

export async function syncMetricsForPost(postId: string) {
  const post = await db.select().from(posts).where(eq(posts.id, postId)).get();
  // Historical imports use null or legacy favikon:* ids — Zernio only.
  if (!post?.zernioPostId || post.zernioPostId.startsWith("favikon:")) return;
  const analytics = await getZernioPostAnalytics(post.zernioPostId);
  if (!analytics) return;

  const impressions =
    analytics.impressions ?? analytics.metrics?.impressions ?? 0;
  const likes = analytics.likes ?? analytics.metrics?.likes ?? 0;
  const comments = analytics.comments ?? analytics.metrics?.comments ?? 0;
  const shares = analytics.shares ?? analytics.metrics?.shares ?? 0;
  const clicks = analytics.clicks ?? analytics.metrics?.clicks ?? 0;
  const saves = analytics.saves ?? analytics.metrics?.saves ?? 0;
  const sends =
    analytics.sends ??
    analytics.metrics?.sends ??
    analytics.metrics?.sendCount ??
    0;
  const reposts =
    analytics.reposts ??
    analytics.metrics?.reposts ??
    analytics.metrics?.repostsCount ??
    shares;
  const engagementRate =
    impressions > 0
      ? ((likes + comments + shares + saves + sends) / impressions) * 100
      : 0;

  await db.insert(metricsSnapshots).values({
    id: randomUUID(),
    postId,
    impressions,
    likes,
    comments,
    shares,
    clicks,
    saves,
    sends,
    reposts,
    engagementRate,
    rawJson: JSON.stringify(analytics),
  });
}

export async function syncAllRecentMetrics() {
  await ensureSchema();
  const recent = await db
    .select()
    .from(posts)
    .where(eq(posts.status, "published"))
    .orderBy(desc(posts.publishedAt))
    .limit(80)
    .all();

  let synced = 0;
  for (const p of recent) {
    if (!p.zernioPostId || p.zernioPostId.startsWith("favikon:")) continue;
    try {
      await syncMetricsForPost(p.id);
      synced += 1;
    } catch (err) {
      console.warn("metrics sync failed", p.id, err);
    }
  }
  return { synced };
}
