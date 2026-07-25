import { NextResponse } from "next/server";
import { z } from "zod";
import { createScheduledPost } from "@/lib/posts";

const schema = z.object({
  content: z.string().min(1),
  title: z.string().optional(),
  scheduledFor: z.string().min(1),
  timezone: z.string().optional(),
  firstComment: z.string().optional(),
  secondComment: z.string().optional(),
  mediaType: z.enum(["image", "video", "document"]).nullable().optional(),
  mediaUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  mediaTitle: z.string().nullable().optional(),
  topics: z.array(z.string()).optional(),
  repostEnabled: z.boolean().optional(),
  repostAfterHours: z.number().optional(),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = schema.parse({
      ...json,
      mediaUrl: json.mediaUrl || null,
    });
    const post = await createScheduledPost({
      ...parsed,
      mediaUrl: parsed.mediaUrl || null,
    });
    return NextResponse.json({ post }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bad request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
