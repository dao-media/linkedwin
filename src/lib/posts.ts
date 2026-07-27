import { addHours, addMinutes } from "date-fns";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  lowercaseHashtagsInText,
  normalizePinnedComments,
} from "./calendar-format";
import { db, ensureSchema } from "./db";
import { automationJobs, metricsSnapshots, posts } from "./schema";
import { getZernioConfig } from "./settings";
import {
  deleteZernioPost,
  scheduleLinkedInPost,
  updateZernioPost,
  updateZernioSchedule,
} from "./zernio";

/**
 * When Zernio credentials exist, schedule/update must succeed unless
 * ZERNIO_REQUIRED=false (local-only demos). Explicit true always requires sync.
 */
async function mustSyncZernio(): Promise<boolean> {
  if (process.env.ZERNIO_REQUIRED === "true") return true;
  if (process.env.ZERNIO_REQUIRED === "false") return false;
  const { apiKey, accountId } = await getZernioConfig();
  return Boolean(apiKey && accountId);
}

function extractZernioPostId(res: unknown): string | null {
  if (!res || typeof res !== "object") return null;
  const r = res as Record<string, unknown>;
  const post = r.post as Record<string, unknown> | undefined;
  const id = post?._id ?? post?.id ?? r._id ?? r.id;
  return typeof id === "string" && id.trim() ? id : null;
}

export type CreatePostInput = {
  title?: string;
  content: string;
  /** Required when scheduling; optional for drafts. */
  scheduledFor?: string;
  timezone?: string;
  /** Prefer this — up to 3, in order. Comment 1 → Zernio; 2–3 → Playwright. */
  comments?: string[];
  firstComment?: string;
  secondComment?: string;
  thirdComment?: string;
  mediaType?: "image" | "video" | "document" | null;
  mediaUrl?: string | null;
  mediaTitle?: string | null;
  topics?: string[];
  repostEnabled?: boolean;
  repostAfterHours?: number;
  publishToZernio?: boolean;
  /** Local draft — no Zernio schedule, no automation jobs yet. */
  asDraft?: boolean;
};

function resolveComments(input: {
  comments?: string[];
  firstComment?: string;
  secondComment?: string;
  thirdComment?: string;
}) {
  if (input.comments?.length) {
    return normalizePinnedComments(input.comments);
  }
  return normalizePinnedComments([
    input.firstComment,
    input.secondComment,
    input.thirdComment,
  ]);
}

async function enqueueAutomationJobs(input: {
  postId: string;
  scheduledFor: string;
  secondComment?: string;
  thirdComment?: string;
  repostEnabled: boolean;
  repostAfterHours: number;
}) {
  if (input.secondComment) {
    await db.insert(automationJobs).values({
      id: randomUUID(),
      postId: input.postId,
      type: "second_comment",
      runAt: addMinutes(new Date(input.scheduledFor), 10).toISOString(),
      status: "pending",
    });
  }
  if (input.thirdComment) {
    await db.insert(automationJobs).values({
      id: randomUUID(),
      postId: input.postId,
      type: "third_comment",
      runAt: addMinutes(new Date(input.scheduledFor), 20).toISOString(),
      status: "pending",
    });
  }
  if (input.repostEnabled) {
    const runAt = addHours(
      new Date(input.scheduledFor),
      input.repostAfterHours,
    ).toISOString();
    await db.insert(automationJobs).values({
      id: randomUUID(),
      postId: input.postId,
      type: "repost",
      runAt,
      status: "pending",
    });
  }
}

export async function createScheduledPost(input: CreatePostInput) {
  await ensureSchema();
  const asDraft = Boolean(input.asDraft);
  if (!asDraft && !input.scheduledFor) {
    throw new Error("scheduledFor is required when scheduling");
  }

  const id = randomUUID();
  const content = lowercaseHashtagsInText(input.content);
  const topicList = (input.topics ?? [])
    .map((t) => t.replace(/^#/, "").trim().toLowerCase())
    .filter(Boolean);
  const topics = JSON.stringify(topicList);
  let zernioPostId: string | null = null;
  const status = asDraft ? "draft" : "scheduled";
  const { firstComment, secondComment, thirdComment } = resolveComments(input);
  const scheduledFor = input.scheduledFor ?? null;
  const repostEnabled = input.repostEnabled ?? true;
  const repostAfterHours = input.repostAfterHours ?? 12;

  if (!asDraft && input.publishToZernio !== false && scheduledFor) {
    const requireZernio = await mustSyncZernio();
    try {
      const res = await scheduleLinkedInPost({
        content,
        scheduledFor,
        timezone: input.timezone,
        firstComment,
        mediaType: input.mediaType,
        mediaUrl: input.mediaUrl,
        mediaTitle: input.mediaTitle,
        tags: topicList,
      });
      zernioPostId = extractZernioPostId(res);
      if (!zernioPostId) {
        throw new Error("Zernio schedule succeeded but returned no post id");
      }
    } catch (err) {
      if (requireZernio) throw err;
      console.warn("Zernio schedule skipped:", err);
    }
  }

  await db.insert(posts).values({
    id,
    title: input.title ?? content.slice(0, 80),
    content,
    status,
    scheduledFor,
    timezone: input.timezone ?? "America/New_York",
    mediaType: input.mediaType ?? null,
    mediaUrl: input.mediaUrl ?? null,
    mediaTitle: input.mediaTitle ?? null,
    firstComment: firstComment ?? null,
    secondComment: secondComment ?? null,
    thirdComment: thirdComment ?? null,
    repostEnabled,
    repostAfterHours,
    zernioPostId,
    topics,
  });

  if (!asDraft && scheduledFor) {
    await enqueueAutomationJobs({
      postId: id,
      scheduledFor,
      secondComment,
      thirdComment,
      repostEnabled,
      repostAfterHours,
    });
  }

  return db.select().from(posts).where(eq(posts.id, id)).get();
}

export async function reschedulePost(
  postId: string,
  scheduledFor: string,
  timezone?: string,
) {
  await ensureSchema();
  const post = await db.select().from(posts).where(eq(posts.id, postId)).get();
  if (!post) throw new Error("Post not found");

  const wasDraft = post.status.toLowerCase() === "draft";
  let zernioPostId = post.zernioPostId;
  const tz = timezone ?? post.timezone;

  const requireZernio = await mustSyncZernio();
  if (zernioPostId) {
    try {
      await updateZernioSchedule(zernioPostId, scheduledFor, tz);
    } catch (err) {
      if (requireZernio) throw err;
      console.warn("Zernio reschedule failed:", err);
    }
  } else if (wasDraft) {
    try {
      let topics: string[] = [];
      try {
        topics = JSON.parse(post.topics || "[]") as string[];
      } catch {
        topics = [];
      }
      const res = await scheduleLinkedInPost({
        content: post.content,
        scheduledFor,
        timezone: tz,
        firstComment: post.firstComment,
        mediaType: post.mediaType as "image" | "video" | "document" | null,
        mediaUrl: post.mediaUrl,
        mediaTitle: post.mediaTitle,
        tags: topics,
      });
      zernioPostId = extractZernioPostId(res);
      if (!zernioPostId) {
        throw new Error("Zernio schedule succeeded but returned no post id");
      }
    } catch (err) {
      if (requireZernio) throw err;
      console.warn("Zernio schedule on draft promote skipped:", err);
    }
  }

  await db
    .update(posts)
    .set({
      scheduledFor,
      timezone: tz,
      status: wasDraft ? "scheduled" : post.status,
      zernioPostId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(posts.id, postId));

  if (wasDraft) {
    const existingJobs = await db
      .select()
      .from(automationJobs)
      .where(eq(automationJobs.postId, postId))
      .all();
    const hasPending = (type: string) =>
      existingJobs.some((j) => j.type === type && j.status === "pending");

    if (post.secondComment && !hasPending("second_comment")) {
      await db.insert(automationJobs).values({
        id: randomUUID(),
        postId,
        type: "second_comment",
        runAt: addMinutes(new Date(scheduledFor), 10).toISOString(),
        status: "pending",
      });
    }
    if (post.thirdComment && !hasPending("third_comment")) {
      await db.insert(automationJobs).values({
        id: randomUUID(),
        postId,
        type: "third_comment",
        runAt: addMinutes(new Date(scheduledFor), 20).toISOString(),
        status: "pending",
      });
    }
    if (post.repostEnabled && !hasPending("repost")) {
      const hours = post.repostAfterHours ?? 12;
      await db.insert(automationJobs).values({
        id: randomUUID(),
        postId,
        type: "repost",
        runAt: addHours(new Date(scheduledFor), hours).toISOString(),
        status: "pending",
      });
    }
  } else {
    if (post.repostEnabled) {
      const hours = post.repostAfterHours ?? 12;
      const runAt = addHours(new Date(scheduledFor), hours).toISOString();
      const jobs = await db
        .select()
        .from(automationJobs)
        .where(eq(automationJobs.postId, postId))
        .all();
      const job = jobs.find(
        (j) => j.type === "repost" && j.status === "pending",
      );
      if (job) {
        await db
          .update(automationJobs)
          .set({ runAt })
          .where(eq(automationJobs.id, job.id));
      }
    }

    {
      const jobs = await db
        .select()
        .from(automationJobs)
        .where(eq(automationJobs.postId, postId))
        .all();
      const offsets: Record<string, number> = {
        second_comment: 10,
        third_comment: 20,
      };
      for (const type of ["second_comment", "third_comment"] as const) {
        const job = jobs.find((j) => j.type === type && j.status === "pending");
        if (!job) continue;
        await db
          .update(automationJobs)
          .set({
            runAt: addMinutes(
              new Date(scheduledFor),
              offsets[type] ?? 10,
            ).toISOString(),
          })
          .where(eq(automationJobs.id, job.id));
      }
    }
  }

  return db.select().from(posts).where(eq(posts.id, postId)).get();
}

const EDITABLE_STATUSES = new Set([
  "draft",
  "scheduled",
  "failed",
  "error",
  "partial",
  "cancelled",
]);

export type UpdatePostInput = {
  content: string;
  comments?: string[];
  firstComment?: string;
  secondComment?: string;
  thirdComment?: string;
  topics?: string[];
  mediaType?: "image" | "video" | "document" | null;
  mediaUrl?: string | null;
  mediaTitle?: string | null;
};

async function syncFollowUpCommentJobs(
  postId: string,
  scheduledFor: string | null | undefined,
  secondComment?: string,
  thirdComment?: string,
) {
  const base = scheduledFor ? new Date(scheduledFor) : new Date();
  const desired: Array<{ type: "second_comment" | "third_comment"; text?: string; mins: number }> =
    [
      { type: "second_comment", text: secondComment, mins: 10 },
      { type: "third_comment", text: thirdComment, mins: 20 },
    ];

  for (const item of desired) {
    const existing = await db
      .select()
      .from(automationJobs)
      .where(
        and(
          eq(automationJobs.postId, postId),
          eq(automationJobs.type, item.type),
          eq(automationJobs.status, "pending"),
        ),
      )
      .all();

    if (item.text) {
      if (existing.length === 0) {
        await db.insert(automationJobs).values({
          id: randomUUID(),
          postId,
          type: item.type,
          runAt: addMinutes(base, item.mins).toISOString(),
          status: "pending",
        });
      }
    } else {
      for (const job of existing) {
        await db
          .update(automationJobs)
          .set({
            status: "failed",
            lastError: "Comment cleared in editor",
            completedAt: new Date().toISOString(),
          })
          .where(eq(automationJobs.id, job.id));
      }
    }
  }
}

export async function updateScheduledPost(postId: string, input: UpdatePostInput) {
  await ensureSchema();
  const post = await db.select().from(posts).where(eq(posts.id, postId)).get();
  if (!post) throw new Error("Post not found");

  const status = post.status.toLowerCase();
  if (!EDITABLE_STATUSES.has(status)) {
    throw new Error("Only draft or scheduled posts can be edited");
  }

  const content = lowercaseHashtagsInText(input.content);
  const { firstComment, secondComment, thirdComment } = resolveComments(input);
  const topicList = (input.topics ?? JSON.parse(post.topics || "[]"))
    .map((t: string) => String(t).replace(/^#/, "").trim().toLowerCase())
    .filter(Boolean);
  const topics = JSON.stringify(topicList);
  const mediaType = input.mediaType !== undefined ? input.mediaType : post.mediaType;
  const mediaUrl = input.mediaUrl !== undefined ? input.mediaUrl : post.mediaUrl;
  const mediaTitle =
    input.mediaTitle !== undefined ? input.mediaTitle : post.mediaTitle;

  if (post.zernioPostId) {
    try {
      await updateZernioPost(post.zernioPostId, {
        content,
        firstComment: firstComment ?? null,
        tags: topicList,
        mediaType: (mediaType as "image" | "video" | "document" | null) ?? null,
        mediaUrl: mediaUrl ?? null,
        mediaTitle: mediaTitle ?? null,
      });
    } catch (err) {
      if (await mustSyncZernio()) throw err;
      console.warn("Zernio content update skipped:", err);
    }
  }

  await db
    .update(posts)
    .set({
      content,
      title: post.title || content.slice(0, 80),
      firstComment: firstComment ?? null,
      secondComment: secondComment ?? null,
      thirdComment: thirdComment ?? null,
      topics,
      mediaType: mediaType ?? null,
      mediaUrl: mediaUrl ?? null,
      mediaTitle: mediaTitle ?? null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(posts.id, postId));

  await syncFollowUpCommentJobs(
    postId,
    post.scheduledFor,
    secondComment,
    thirdComment,
  );

  return db.select().from(posts).where(eq(posts.id, postId)).get();
}

async function cancelPendingJobs(postId: string, reason: string) {
  const jobs = await db
    .select()
    .from(automationJobs)
    .where(
      and(eq(automationJobs.postId, postId), eq(automationJobs.status, "pending")),
    )
    .all();
  for (const job of jobs) {
    await db
      .update(automationJobs)
      .set({
        status: "failed",
        lastError: reason,
        completedAt: new Date().toISOString(),
      })
      .where(eq(automationJobs.id, job.id));
  }
}

/** Unschedule a post locally (and on Zernio when connected). */
export async function movePostToDraft(postId: string) {
  await ensureSchema();
  const post = await db.select().from(posts).where(eq(posts.id, postId)).get();
  if (!post) throw new Error("Post not found");

  const status = post.status.toLowerCase();
  if (status === "draft") return post;
  if (status === "published") {
    throw new Error("Published posts cannot be moved to drafts");
  }

  if (post.zernioPostId) {
    try {
      await deleteZernioPost(post.zernioPostId);
    } catch (err) {
      // Scheduled posts must leave Zernio or they will still publish.
      throw err instanceof Error
        ? err
        : new Error("Could not cancel Zernio schedule");
    }
  }

  await cancelPendingJobs(postId, "Moved to draft");

  await db
    .update(posts)
    .set({
      status: "draft",
      zernioPostId: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(posts.id, postId));

  return db.select().from(posts).where(eq(posts.id, postId)).get();
}

/** Permanently remove a post from LinkedWin (and Zernio when connected). */
export async function deletePost(postId: string) {
  await ensureSchema();
  const post = await db.select().from(posts).where(eq(posts.id, postId)).get();
  if (!post) throw new Error("Post not found");

  if (post.zernioPostId) {
    const status = post.status.toLowerCase();
    try {
      await deleteZernioPost(post.zernioPostId);
    } catch (err) {
      // Published posts often cannot be deleted via Zernio — local remove still proceeds.
      // Draft/scheduled must cancel remotely or LinkedIn will still get the post.
      if (status === "scheduled" || status === "draft") {
        throw err instanceof Error
          ? err
          : new Error("Could not delete Zernio schedule");
      }
      console.warn("Zernio delete skipped (published):", err);
    }
  }

  await db.delete(automationJobs).where(eq(automationJobs.postId, postId));
  await db
    .delete(metricsSnapshots)
    .where(eq(metricsSnapshots.postId, postId));
  await db.delete(posts).where(eq(posts.id, postId));
  return { ok: true as const };
}
