import { NextResponse } from "next/server";
import {
  linkedInSessionIsSet,
  normalizeLinkedInSessionInput,
} from "@/lib/linkedin-session";
import { getSetting, setSetting } from "@/lib/settings";

export async function GET() {
  const apiKey = await getSetting("zernio_api_key");
  const linkedinSession = await getSetting("linkedin_session");
  const sessionOk = linkedInSessionIsSet(linkedinSession);
  // Surface corruption so Settings doesn't claim a healthy stored session.
  let sessionHealth = (await getSetting("session_health")) ?? "unknown";
  if (!sessionOk && linkedinSession?.trim()) {
    sessionHealth = "expired";
  }

  return NextResponse.json({
    zernioApiKeySet: Boolean(apiKey || process.env.ZERNIO_API_KEY),
    zernioAccountId:
      (await getSetting("zernio_linkedin_account_id")) ??
      process.env.ZERNIO_LINKEDIN_ACCOUNT_ID ??
      "",
    zernioAccountLabel: (await getSetting("zernio_account_label")) ?? "",
    sessionHealth,
    linkedinSessionSet: sessionOk,
    sessionCorrupt: Boolean(linkedinSession?.trim() && !sessionOk),
    niches:
      (await getSetting("niches")) ?? "AI agents, B2B content, Product ops",
    linkedinFollowers: (await getSetting("linkedin_followers")) ?? "",
    lastSyncedAt: (await getSetting("last_zernio_sync_at")) ?? null,
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body.zernioApiKey) {
    await setSetting("zernio_api_key", String(body.zernioApiKey));
  }
  if (body.zernioAccountId != null) {
    await setSetting("zernio_linkedin_account_id", String(body.zernioAccountId));
  }
  if (body.niches != null) {
    await setSetting("niches", String(body.niches));
  }
  if (body.sessionHealth != null) {
    await setSetting("session_health", String(body.sessionHealth));
  }
  if (body.linkedinSession != null && body.linkedinSession !== "") {
    try {
      const normalized = normalizeLinkedInSessionInput(body.linkedinSession);
      await setSetting("linkedin_session", normalized);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Invalid LinkedIn session";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }
  return NextResponse.json({ ok: true });
}
