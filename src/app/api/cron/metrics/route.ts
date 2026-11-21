import { NextResponse } from "next/server";
import { getZernioConfig } from "@/lib/settings";
import { syncFromZernio } from "@/lib/sync";

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Zernio is optional — without a key this daily cron is a no-op
  const { apiKey } = await getZernioConfig();
  if (!apiKey) {
    return NextResponse.json({ ok: true, skipped: "Zernio not configured" });
  }
  const result = await syncFromZernio();
  return NextResponse.json(result);
}
