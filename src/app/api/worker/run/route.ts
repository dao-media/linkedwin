import { NextResponse } from "next/server";
import { processDueJobs } from "@/lib/jobs";

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET ?? process.env.WORKER_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await processDueJobs(20);
  return NextResponse.json(result);
}

export async function GET(req: Request) {
  return POST(req);
}
