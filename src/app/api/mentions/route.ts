import { NextResponse } from "next/server";
import {
  listSavedMentions,
  saveSavedMentions,
  upsertSavedMention,
  type SavedMention,
} from "@/lib/mentions";

export async function GET() {
  const mentions = await listSavedMentions();
  return NextResponse.json({ mentions });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const url = String(body.url ?? "").trim();
  const mentionFormat = String(body.mentionFormat ?? "").trim();
  const label = String(
    body.label ?? body.displayName ?? mentionFormat ?? "",
  ).trim();
  if (!url || !mentionFormat || !label) {
    return NextResponse.json(
      { error: "url, mentionFormat, and label are required" },
      { status: 400 },
    );
  }

  const mentions = await listSavedMentions();
  const next = upsertSavedMention(mentions, {
    label,
    url,
    displayName: body.displayName ? String(body.displayName) : undefined,
    mentionFormat,
    urn: body.urn ? String(body.urn) : undefined,
    type: body.type ? String(body.type) : undefined,
  });
  await saveSavedMentions(next);
  return NextResponse.json({ mention: next[0], mentions: next });
}

export async function DELETE(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "");
  if (!id) {
    return NextResponse.json({ error: "Id is required" }, { status: 400 });
  }

  const mentions = await listSavedMentions();
  const next = mentions.filter((m: SavedMention) => m.id !== id);
  if (next.length === mentions.length) {
    return NextResponse.json({ error: "Mention not found" }, { status: 404 });
  }
  await saveSavedMentions(next);
  return NextResponse.json({ ok: true, mentions: next });
}
