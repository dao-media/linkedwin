import { NextResponse } from "next/server";
import {
  MEDIA_BLOB_MAX_BYTES,
  MEDIA_SERVER_MAX_BYTES,
  mediaProvider,
} from "@/lib/media";

export async function GET() {
  const provider = mediaProvider();
  return NextResponse.json({
    provider,
    maxBytes:
      provider === "blob" ? MEDIA_BLOB_MAX_BYTES : MEDIA_SERVER_MAX_BYTES,
  });
}
