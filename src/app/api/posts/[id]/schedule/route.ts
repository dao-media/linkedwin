import { NextResponse } from "next/server";
import { z } from "zod";
import { reschedulePost } from "@/lib/posts";

const schema = z.object({
  scheduledFor: z.string().min(1),
  timezone: z.string().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const body = schema.parse(await req.json());
    const post = await reschedulePost(id, body.scheduledFor, body.timezone);
    return NextResponse.json({ post });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bad request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
