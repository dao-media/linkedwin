import { randomUUID } from "node:crypto";
import { getZernioConfig } from "./settings";

const BASE = process.env.ZERNIO_BASE_URL ?? "https://api.zernio.com";

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
