import { NextResponse } from "next/server";
import { syncFromZernio } from "@/lib/sync";

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET ?? process.env.WORKER_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await syncFromZernio();
  return NextResponse.json(result);
}
