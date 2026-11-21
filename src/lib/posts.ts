/**
 * Local content management. LinkedWin plans and drafts posts; you publish them
 * on LinkedIn yourself, and activity sync pulls the published version back in.
 *
 * Status meanings: draft → scheduled (planned for a date on the calendar) → published.
 */
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  lowercaseHashtagsInText,
  normalizePinnedComments,
} from "./calendar-format";
import { db, ensureSchema } from "./db";
import { metricsSnapshots, posts } from "./schema";

export type CreatePostInput = {
  title?: string;
  content: string;
  /** Planned publish time; required unless saving as a draft. */
  scheduledFor?: string;
  timezone?: string;
  /** Planned comments (pinned first comment + follow-ups), up to 3, in order. */
  comments?: string[];
  firstComment?: string;
  secondComment?: string;
  thirdComment?: string;
  mediaType?: "image" | "video" | "document" | null;
  mediaUrl?: string | null;
  mediaTitle?: string | null;
  topics?: string[];
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

function normalizeTopics(list: unknown[]) {
  return JSON.stringify(
    list
      .map((t) => String(t).replace(/^#/, "").trim().toLowerCase())
      .filter(Boolean),
  );
}

async function getPost(postId: string) {
  const post = await db.select().from(posts).where(eq(posts.id, postId)).get();
  if (!post) throw new Error("Post not found");
  return post;
}

export async function createScheduledPost(input: CreatePostInput) {
  await ensureSchema();
  const asDraft = Boolean(input.asDraft);
  if (!asDraft && !input.scheduledFor) {
    throw new Error("Pick a date to plan this post, or save it as a draft");
  }

  const id = randomUUID();
  const content = lowercaseHashtagsInText(input.content);
  const { firstComment, secondComment, thirdComment } = resolveComments(input);

  await db.insert(posts).values({
    id,
    title: input.title ?? content.slice(0, 80),
    content,
    status: asDraft ? "draft" : "scheduled",
    scheduledFor: input.scheduledFor ?? null,
    timezone: input.timezone ?? "America/New_York",
    mediaType: input.mediaType ?? null,
    mediaUrl: input.mediaUrl ?? null,
    mediaTitle: input.mediaTitle ?? null,
    firstComment: firstComment ?? null,
    secondComment: secondComment ?? null,
    thirdComment: thirdComment ?? null,
    repostEnabled: false,
    topics: normalizeTopics(input.topics ?? []),
  });

  return getPost(id);
}

export async function reschedulePost(
  postId: string,
  scheduledFor: string,
  timezone?: string,
) {
  await ensureSchema();
  const post = await getPost(postId);
  const wasDraft = post.status.toLowerCase() === "draft";

  await db
    .update(posts)
    .set({
      scheduledFor,
      timezone: timezone ?? post.timezone,
      status: wasDraft ? "scheduled" : post.status,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(posts.id, postId));

  return getPost(postId);
}

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

export async function updateScheduledPost(postId: string, input: UpdatePostInput) {
  await ensureSchema();
  const post = await getPost(postId);

  const content = lowercaseHashtagsInText(input.content);
  const { firstComment, secondComment, thirdComment } = resolveComments(input);

  await db
    .update(posts)
    .set({
      content,
      title: post.title || content.slice(0, 80),
      firstComment: firstComment ?? null,
      secondComment: secondComment ?? null,
      thirdComment: thirdComment ?? null,
      topics: normalizeTopics(input.topics ?? JSON.parse(post.topics || "[]")),
      mediaType: input.mediaType !== undefined ? input.mediaType : post.mediaType,
      mediaUrl: input.mediaUrl !== undefined ? input.mediaUrl : post.mediaUrl,
      mediaTitle: input.mediaTitle !== undefined ? input.mediaTitle : post.mediaTitle,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(posts.id, postId));

  return getPost(postId);
}

/** Take a planned post off the calendar. */
export async function movePostToDraft(postId: string) {
  await ensureSchema();
  const post = await getPost(postId);
  const status = post.status.toLowerCase();
  if (status === "draft") return post;
  if (status === "published") {
    throw new Error("Published posts cannot be moved to drafts");
  }

  await db
    .update(posts)
    .set({ status: "draft", updatedAt: new Date().toISOString() })
    .where(eq(posts.id, postId));

  return getPost(postId);
}

/** Permanently remove a post from LinkedWin (never touches LinkedIn). */
export async function deletePost(postId: string) {
  await ensureSchema();
  await getPost(postId);
  await db.delete(metricsSnapshots).where(eq(metricsSnapshots.postId, postId));
  await db.delete(posts).where(eq(posts.id, postId));
  return { ok: true as const };
}
