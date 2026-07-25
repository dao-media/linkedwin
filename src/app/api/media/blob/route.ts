import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import {
  MEDIA_ALLOWED_TYPES,
  MEDIA_BLOB_MAX_BYTES,
  hasBlobToken,
} from "@/lib/media";

export async function POST(request: Request): Promise<NextResponse> {
  if (!hasBlobToken()) {
    return NextResponse.json(
      {
        error:
          "Vercel Blob is not configured. Set BLOB_READ_WRITE_TOKEN, or use local upload.",
      },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as HandleUploadBody;
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [...MEDIA_ALLOWED_TYPES],
        maximumSizeInBytes: MEDIA_BLOB_MAX_BYTES,
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ source: "composer" }),
      }),
      onUploadCompleted: async () => {
        // Public URL is returned to the client; nothing else to persist.
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
