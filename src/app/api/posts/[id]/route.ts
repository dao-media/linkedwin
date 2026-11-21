import { NextResponse } from "next/server";
import { z } from "zod";
import {
  deletePost,
  movePostToDraft,
  updateScheduledPost,
} from "@/lib/posts";

const updateSchema = z.object({
  content: z.string().min(1),
  comments: z.array(z.string()).max(3).optional(),
  firstComment: z.string().optional(),
  secondComment: z.string().optional(),
  thirdComment: z.string().optional(),
  topics: z.array(z.string()).optional(),
  mediaType: z.enum(["image", "video", "document"]).nullable().optional(),
  mediaUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  mediaTitle: z.string().nullable().optional(),
});

const moveToDraftSchema = z.object({
  action: z.literal("moveToDraft"),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const json = await req.json();

    if (json?.action === "moveToDraft") {
      moveToDraftSchema.parse(json);
      const post = await movePostToDraft(id);
      return NextResponse.json({ post });
    }

    const parsed = updateSchema.parse({
      ...json,
      mediaUrl: json.mediaUrl || null,
    });
    const post = await updateScheduledPost(id, {
      ...parsed,
      mediaUrl: parsed.mediaUrl || null,
    });
    return NextResponse.json({ post });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bad request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    await deletePost(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bad request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
