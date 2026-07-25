import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveLinkedInMention } from "@/lib/zernio";

const schema = z.object({
  url: z.string().min(1),
  displayName: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = schema.parse({
      url: searchParams.get("url") ?? "",
      displayName: searchParams.get("displayName") || undefined,
    });
    const mention = await resolveLinkedInMention(parsed);
    return NextResponse.json({ mention });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to resolve";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
