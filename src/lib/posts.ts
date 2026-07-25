import { addHours } from "date-fns";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db, ensureSchema } from "./db";
import { automationJobs, posts } from "./schema";
import { scheduleLinkedInPost, updateZernioSchedule } from "./zernio";

export type CreatePostInput = {
  title?: string;
  content: string;
  scheduledFor: string;
  timezone?: string;
  firstComment?: string;
  secondComment?: string;
  mediaType?: "image" | "video" | "document" | null;
  mediaUrl?: string | null;
  mediaTitle?: string | null;
  topics?: string[];
  repostEnabled?: boolean;
  repostAfterHours?: number;
  publishToZernio?: boolean;
};

export async function createScheduledPost(input: CreatePostInput) {
  await ensureSchema();
  const id = randomUUID();
  const topics = JSON.stringify(input.topics ?? []);
  let zernioPostId: string | null = null;
  const status = "scheduled";

  if (input.publishToZernio !== false) {
    try {
      const res = await scheduleLinkedInPost({
        content: input.content,
        scheduledFor: input.scheduledFor,
        timezone: input.timezone,
        firstComment: input.firstComment,
        mediaType: input.mediaType,
        mediaUrl: input.mediaUrl,
        mediaTitle: input.mediaTitle,
        tags: input.topics,
      });
      zernioPostId =
        res?.post?._id ?? res?.post?.id ?? res?._id ?? res?.id ?? null;
    } catch (err) {
      if (process.env.ZERNIO_REQUIRED === "true") throw err;
      console.warn("Zernio schedule skipped:", err);
    }
  }

  await db.insert(posts).values({
    id,
    title: input.title ?? input.content.slice(0, 80),
    content: input.content,
    status,
    scheduledFor: input.scheduledFor,
    timezone: input.timezone ?? "America/New_York",
    mediaType: input.mediaType ?? null,
    mediaUrl: input.mediaUrl ?? null,
    mediaTitle: input.mediaTitle ?? null,
    firstComment: input.firstComment ?? null,
    secondComment: input.secondComment ?? null,
    repostEnabled: input.repostEnabled ?? true,
    repostAfterHours: input.repostAfterHours ?? 12,
    zernioPostId,
    topics,
  });

  if (input.secondComment) {
    await db.insert(automationJobs).values({
      id: randomUUID(),
      postId: id,
      type: "second_comment",
      runAt: input.scheduledFor,
      status: "pending",
    });
  }

  if (input.repostEnabled !== false) {
    const hours = input.repostAfterHours ?? 12;
    const runAt = addHours(new Date(input.scheduledFor), hours).toISOString();
    await db.insert(automationJobs).values({
      id: randomUUID(),
      postId: id,
      type: "repost",
      runAt,
      status: "pending",
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

  if (post.zernioPostId) {
    try {
      await updateZernioSchedule(post.zernioPostId, scheduledFor, timezone);
    } catch (err) {
      console.warn("Zernio reschedule failed:", err);
    }
  }

  await db
    .update(posts)
    .set({
      scheduledFor,
      timezone: timezone ?? post.timezone,
      status:
        post.status.toLowerCase() === "draft" ? "scheduled" : post.status,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(posts.id, postId));

  if (post.repostEnabled) {
    const hours = post.repostAfterHours ?? 12;
    const runAt = addHours(new Date(scheduledFor), hours).toISOString();
    const jobs = await db
      .select()
      .from(automationJobs)
      .where(eq(automationJobs.postId, postId))
      .all();
    const job = jobs.find((j) => j.type === "repost" && j.status === "pending");
    if (job) {
      await db
        .update(automationJobs)
        .set({ runAt })
        .where(eq(automationJobs.id, job.id));
    }
  }

  return db.select().from(posts).where(eq(posts.id, postId)).get();
}
