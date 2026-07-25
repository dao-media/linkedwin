import { NextResponse } from "next/server";
import { checkPassword, createSession } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (!checkPassword(String(body.password ?? ""))) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }
  await createSession();
  return NextResponse.json({ ok: true });
}
