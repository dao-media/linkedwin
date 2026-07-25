import { NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/settings";
import { recordFollowerSnapshot } from "@/lib/trends";

export async function GET() {
  const apiKey = await getSetting("zernio_api_key");
  return NextResponse.json({
    zernioApiKeySet: Boolean(apiKey || process.env.ZERNIO_API_KEY),
    zernioAccountId:
      (await getSetting("zernio_linkedin_account_id")) ??
      process.env.ZERNIO_LINKEDIN_ACCOUNT_ID ??
      "",
    sessionHealth: (await getSetting("session_health")) ?? "unknown",
    niches:
      (await getSetting("niches")) ?? "AI agents, B2B content, Product ops",
    linkedinFollowers: (await getSetting("linkedin_followers")) ?? "",
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
  if (body.linkedinFollowers != null) {
    const raw = String(body.linkedinFollowers).trim();
    await setSetting("linkedin_followers", raw);
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) {
      await recordFollowerSnapshot(n, "settings");
    }
  }
  if (body.linkedinSession != null) {
    await setSetting("linkedin_session", String(body.linkedinSession));
  }
  return NextResponse.json({ ok: true });
}
