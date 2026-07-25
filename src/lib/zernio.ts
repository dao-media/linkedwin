import { randomUUID } from "node:crypto";
import { getZernioConfig } from "./settings";

const BASE = process.env.ZERNIO_BASE_URL ?? "https://api.zernio.com";

export type SchedulePostInput = {
  content: string;
  scheduledFor: string;
  timezone?: string;
  firstComment?: string | null;
  mediaType?: "image" | "video" | "document" | null;
  mediaUrl?: string | null;
  mediaTitle?: string | null;
  tags?: string[];
};

async function zernioFetch(path: string, init: RequestInit = {}) {
  const { apiKey } = await getZernioConfig();
  if (!apiKey) {
    throw new Error("Zernio API key not configured");
  }
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "x-request-id": randomUUID(),
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof body?.error === "string"
        ? body.error
        : `Zernio ${res.status}: ${JSON.stringify(body)}`,
    );
  }
  return body;
}

export async function listZernioAccounts() {
  return zernioFetch("/v1/accounts");
}

export async function getZernioAccount(accountId: string) {
  try {
    return await zernioFetch(`/v1/accounts/${accountId}`);
  } catch {
    return null;
  }
}

export async function getZernioFollowerStats(accountId?: string) {
  const params = new URLSearchParams({ granularity: "daily" });
  if (accountId) params.set("accountIds", accountId);
  return zernioFetch(`/v1/accounts/follower-stats?${params.toString()}`);
}

export async function listZernioPosts(opts?: {
  accountId?: string;
  source?: "zernio" | "external";
  page?: number;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (opts?.accountId) params.set("accountId", opts.accountId);
  if (opts?.source) params.set("source", opts.source);
  params.set("page", String(opts?.page ?? 1));
  params.set("limit", String(opts?.limit ?? 50));
  return zernioFetch(`/v1/posts?${params.toString()}`);
}

export async function scheduleLinkedInPost(input: SchedulePostInput) {
  const { accountId } = await getZernioConfig();
  if (!accountId) {
    throw new Error("Zernio LinkedIn account ID not configured");
  }

  const mediaItems =
    input.mediaUrl && input.mediaType
      ? [
          {
            type: input.mediaType,
            url: input.mediaUrl,
            title: input.mediaTitle ?? undefined,
          },
        ]
      : undefined;

  const platformSpecificData: Record<string, string> = {};
  if (input.firstComment) {
    platformSpecificData.firstComment = input.firstComment;
  }
  if (input.mediaType === "document" && input.mediaTitle) {
    platformSpecificData.documentTitle = input.mediaTitle;
  }

  return zernioFetch("/v1/posts", {
    method: "POST",
    body: JSON.stringify({
      content: input.content,
      scheduledFor: input.scheduledFor,
      timezone: input.timezone ?? "America/New_York",
      publishNow: false,
      tags: input.tags,
      mediaItems,
      platforms: [
        {
          platform: "linkedin",
          accountId,
          platformSpecificData:
            Object.keys(platformSpecificData).length > 0
              ? platformSpecificData
              : undefined,
        },
      ],
    }),
  });
}

export async function updateZernioSchedule(
  zernioPostId: string,
  scheduledFor: string,
  timezone?: string,
) {
  return zernioFetch(`/v1/posts/${zernioPostId}`, {
    method: "PATCH",
    body: JSON.stringify({
      scheduledFor,
      timezone: timezone ?? "America/New_York",
    }),
  });
}

export type LinkedInMentionResult = {
  urn: string;
  type: string;
  displayName?: string;
  mentionFormat: string;
};

/** Resolve a LinkedIn profile/company URL to an embeddable @mention format. */
export async function resolveLinkedInMention(input: {
  url: string;
  displayName?: string;
}) {
  const { accountId } = await getZernioConfig();
  if (!accountId) {
    throw new Error("Zernio LinkedIn account ID not configured");
  }
  const params = new URLSearchParams({ url: input.url });
  if (input.displayName?.trim()) {
    params.set("displayName", input.displayName.trim());
  }
  return zernioFetch(
    `/v1/accounts/${accountId}/linkedin-mentions?${params.toString()}`,
  ) as Promise<LinkedInMentionResult>;
}

export async function updateZernioPost(
  zernioPostId: string,
  input: {
    content?: string;
    firstComment?: string | null;
    tags?: string[];
    mediaType?: "image" | "video" | "document" | null;
    mediaUrl?: string | null;
    mediaTitle?: string | null;
  },
) {
  const body: Record<string, unknown> = {};
  if (input.content !== undefined) body.content = input.content;
  if (input.tags !== undefined) body.tags = input.tags;

  if (input.mediaUrl && input.mediaType) {
    body.mediaItems = [
      {
        type: input.mediaType,
        url: input.mediaUrl,
        title: input.mediaTitle ?? undefined,
      },
    ];
  }

  if (input.firstComment !== undefined) {
    const { accountId } = await getZernioConfig();
    if (accountId) {
      body.platforms = [
        {
          platform: "linkedin",
          accountId,
          platformSpecificData: input.firstComment
            ? { firstComment: input.firstComment }
            : {},
        },
      ];
    }
  }

  return zernioFetch(`/v1/posts/${zernioPostId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function getZernioPost(zernioPostId: string) {
  return zernioFetch(`/v1/posts/${zernioPostId}`);
}

export async function getZernioPostAnalytics(zernioPostId: string) {
  try {
    return await zernioFetch(`/v1/analytics/posts/${zernioPostId}`);
  } catch {
    return null;
  }
}
