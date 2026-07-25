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
