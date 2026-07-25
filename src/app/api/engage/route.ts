import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db, ensureSchema } from "@/lib/db";
import { engageRecs } from "@/lib/schema";

const schema = z.object({
  items: z.array(
    z.object({
      handle: z.string(),
      postUrl: z.string().url().optional(),
      reason: z.string(),
      score: z.number().default(50),
    }),
  ),
});

export async function POST(req: Request) {
  await ensureSchema();
  try {
    const body = schema.parse(await req.json());
    for (const item of body.items) {
      await db.insert(engageRecs).values({
        id: randomUUID(),
        handle: item.handle,
        postUrl: item.postUrl,
        reason: item.reason,
        score: item.score,
      });
    }
    return NextResponse.json({ ok: true, count: body.items.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bad request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
