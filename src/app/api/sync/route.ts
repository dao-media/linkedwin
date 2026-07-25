import { NextResponse } from "next/server";
import { getLastSyncAt, syncFromZernio } from "@/lib/sync";

export async function GET() {
  return NextResponse.json({
    lastSyncedAt: await getLastSyncAt(),
  });
}

export async function POST() {
  try {
    const result = await syncFromZernio();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Sync failed",
      },
      { status: 500 },
    );
  }
}
