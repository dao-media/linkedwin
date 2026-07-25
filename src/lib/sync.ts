import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db, ensureSchema } from "@/lib/db";
import { syncAllRecentMetrics } from "@/lib/jobs";
import { posts } from "@/lib/schema";
import { getSetting, getZernioConfig, setSetting } from "@/lib/settings";
import { recordFollowerSnapshot } from "@/lib/trends";
import {
  getZernioAccount,
  listZernioAccounts,
  listZernioPosts,
} from "@/lib/zernio";

export type SyncResult = {
  ok: boolean;
  followers: number | null;
  accountDisplayName: string | null;
  postsImported: number;
  metricsSynced: number;
  demoPostsRemoved: number;
  warnings: string[];
  syncedAt: string;
};

function pickFollowers(account: Record<string, unknown> | null | undefined) {
  if (!account) return null;
  const n = Number(
    account.followersCount ??
      account.currentFollowers ??
      (account as { followers?: number }).followers,
  );
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

function extractPostFields(remote: Record<string, unknown>) {
  const id =
    String(remote._id ?? remote.id ?? "").trim() || null;
  const content = String(
    remote.content ?? remote.text ?? remote.caption ?? "",
  ).trim();
  const statusRaw = String(remote.status ?? "").toLowerCase();
  const status =
    statusRaw.includes("publish") || statusRaw === "posted"
      ? "published"
      : statusRaw.includes("fail")
        ? "failed"
        : statusRaw.includes("draft")
          ? "draft"
          : "scheduled";
  const scheduledFor =
    (remote.scheduledFor as string | undefined) ??
    (remote.scheduled_for as string | undefined) ??
    null;
  const publishedAt =
    (remote.publishedAt as string | undefined) ??
    (remote.published_at as string | undefined) ??
    (status === "published" ? scheduledFor : null);
  const platforms = Array.isArray(remote.platforms)
    ? (remote.platforms as Record<string, unknown>[])
    : [];
  const linkedin = platforms.find(
    (p) => String(p.platform ?? "").toLowerCase() === "linkedin",
  );
  const url =
    (remote.platformPostUrl as string | undefined) ??
    (linkedin?.platformPostUrl as string | undefined) ??
    (linkedin?.url as string | undefined) ??
    null;
  const firstComment =
    (linkedin?.platformSpecificData as { firstComment?: string } | undefined)
      ?.firstComment ?? null;

  return {
    zernioPostId: id,
    content,
    title: content.slice(0, 80) || "Untitled post",
    status,
    scheduledFor,
    publishedAt,
    linkedinPostUrl: url,
    firstComment,
    topics: JSON.stringify(
      Array.isArray(remote.tags) ? remote.tags : [],
    ),
  };
}

export async function syncFromZernio(): Promise<SyncResult> {
  await ensureSchema();
  const warnings: string[] = [];
  const syncedAt = new Date().toISOString();
  const { accountId } = await getZernioConfig();

  let account: Record<string, unknown> | null = null;
  let accountDisplayName: string | null = null;

  try {
    const listed = await listZernioAccounts();
    const accounts = Array.isArray(listed?.accounts)
      ? (listed.accounts as Record<string, unknown>[])
      : Array.isArray(listed)
        ? (listed as Record<string, unknown>[])
        : [];
    account =
      accounts.find((a) => String(a._id ?? a.id) === accountId) ??
      accounts.find(
        (a) => String(a.platform ?? "").toLowerCase() === "linkedin",
      ) ??
      accounts[0] ??
      null;
    if (!account && accountId) {
      account = await getZernioAccount(accountId);
    }
    accountDisplayName =
      (account?.displayName as string | undefined) ??
      (account?.username as string | undefined) ??
      null;
  } catch (err) {
    warnings.push(
      err instanceof Error
        ? `Account lookup failed: ${err.message}`
        : "Account lookup failed",
    );
  }

  const followers = pickFollowers(account);
  if (followers != null) {
    await setSetting("linkedin_followers", String(followers));
    await recordFollowerSnapshot(followers, "zernio", syncedAt);
  } else {
    warnings.push(
      "Could not read follower count from Zernio yet (may need analytics access).",
    );
  }

  let postsImported = 0;
  try {
    const remotePosts = await listZernioPosts({
      accountId: accountId || undefined,
      limit: 50,
    });
    const list = Array.isArray(remotePosts?.posts)
      ? (remotePosts.posts as Record<string, unknown>[])
      : [];

    for (const remote of list) {
      const fields = extractPostFields(remote);
      if (!fields.zernioPostId || !fields.content) continue;

      const existing = await db
        .select()
        .from(posts)
        .where(eq(posts.zernioPostId, fields.zernioPostId))
        .get();

      if (existing) {
        await db
          .update(posts)
          .set({
            content: fields.content,
            title: fields.title,
            status: fields.status,
            scheduledFor: fields.scheduledFor,
            publishedAt: fields.publishedAt,
            linkedinPostUrl: fields.linkedinPostUrl,
            firstComment: fields.firstComment ?? existing.firstComment,
            topics: fields.topics,
            updatedAt: syncedAt,
            followersAtPublish:
              existing.followersAtPublish ??
              (fields.status === "published" ? followers : null),
          })
          .where(eq(posts.id, existing.id));
      } else {
        await db.insert(posts).values({
          id: randomUUID(),
          title: fields.title,
          content: fields.content,
          status: fields.status,
          scheduledFor: fields.scheduledFor,
          publishedAt: fields.publishedAt,
          linkedinPostUrl: fields.linkedinPostUrl,
          firstComment: fields.firstComment,
          zernioPostId: fields.zernioPostId,
          topics: fields.topics,
          followersAtPublish:
            fields.status === "published" ? followers : null,
          createdAt: syncedAt,
          updatedAt: syncedAt,
        });
        postsImported += 1;
      }
    }

    if (list.length === 0) {
      warnings.push(
        "No posts in Zernio yet. Historical analytics stay on the pre-handoff LinkedIn export; new Composer/Zernio posts will fill in from here.",
      );
    }
  } catch (err) {
    warnings.push(
      err instanceof Error
        ? `Post import failed: ${err.message}`
        : "Post import failed",
    );
  }

  // Keep local/imported posts (Favikon + LinkedIn export). Only real
  // Zernio-linked rows are updated above; historical rows have null zernio ids.
  const demoPostsRemoved = 0;

  let metricsSynced = 0;
  try {
    const metrics = await syncAllRecentMetrics();
    metricsSynced = metrics.synced;
  } catch (err) {
    warnings.push(
      err instanceof Error
        ? `Metrics sync failed: ${err.message}`
        : "Metrics sync failed",
    );
  }

  await setSetting("last_zernio_sync_at", syncedAt);
  if (accountDisplayName) {
    await setSetting("zernio_account_label", accountDisplayName);
  }

  // Prefer configured account id if we discovered a LinkedIn account and none set.
  if (!accountId && account) {
    const discovered = String(account._id ?? account.id ?? "");
    if (discovered) {
      await setSetting("zernio_linkedin_account_id", discovered);
    }
  }

  return {
    ok: warnings.length === 0 || followers != null || postsImported > 0,
    followers,
    accountDisplayName,
    postsImported,
    metricsSynced,
    demoPostsRemoved,
    warnings,
    syncedAt,
  };
}

export async function getLastSyncAt() {
  return (await getSetting("last_zernio_sync_at")) ?? null;
}
