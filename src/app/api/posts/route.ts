import { NextResponse } from "next/server";
import { z } from "zod";
import { createScheduledPost } from "@/lib/posts";

const schema = z
  .object({
    content: z.string().min(1),
    title: z.string().optional(),
    scheduledFor: z.string().optional(),
    timezone: z.string().optional(),
    /** Up to 3 pinned comments in order. */
    comments: z.array(z.string()).max(3).optional(),
    firstComment: z.string().optional(),
    secondComment: z.string().optional(),
    thirdComment: z.string().optional(),
    mediaType: z.enum(["image", "video", "document"]).nullable().optional(),
    mediaUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
    mediaTitle: z.string().nullable().optional(),
    topics: z.array(z.string()).optional(),
    asDraft: z.boolean().optional(),
  })
  .superRefine((val, ctx) => {
    if (!val.asDraft && !val.scheduledFor) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pick a date to plan this post, or save it as a draft",
        path: ["scheduledFor"],
      });
    }
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
