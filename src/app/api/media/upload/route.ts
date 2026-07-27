import { mkdir, writeFile } from "node:fs/promises";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import {
  MEDIA_ALLOWED_TYPES,
  MEDIA_SERVER_MAX_BYTES,
  buildStoredFilename,
  hasBlobToken,
  inferMediaType,
  uploadsDir,
} from "@/lib/media";

export async function POST(request: Request) {
  try {
    if (!hasBlobToken() && process.env.VERCEL === "1") {
      return NextResponse.json(
        {
          error:
            "BLOB_READ_WRITE_TOKEN is required on Vercel. Local filesystem uploads do not persist across serverless instances.",
        },
        { status: 503 },
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }

    if (file.size > MEDIA_SERVER_MAX_BYTES && !hasBlobToken()) {
      return NextResponse.json(
        {
          error: `File too large for local upload (max ${Math.round(MEDIA_SERVER_MAX_BYTES / (1024 * 1024))}MB). Configure BLOB_READ_WRITE_TOKEN for larger files.`,
        },
        { status: 413 },
      );
    }

    const mime = file.type || "application/octet-stream";
    if (
      !(MEDIA_ALLOWED_TYPES as readonly string[]).includes(mime) &&
      !inferMediaType(mime, file.name)
    ) {
      return NextResponse.json(
        {
          error:
            "Unsupported file type. Use an image, PDF, or video (mp4/webm).",
        },
        { status: 400 },
      );
    }

    const mediaType = inferMediaType(mime, file.name);
    if (!mediaType) {
      return NextResponse.json(
        { error: "Could not detect media type" },
        { status: 400 },
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const storedName = buildStoredFilename(file.name);
    let url: string;

    if (hasBlobToken()) {
      const blob = await put(`media/${storedName}`, bytes, {
        access: "public",
        contentType: mime,
        addRandomSuffix: false,
      });
      url = blob.url;
    } else {
      const dir = uploadsDir();
      await mkdir(dir, { recursive: true });
      await writeFile(`${dir}/${storedName}`, bytes);
      const origin = new URL(request.url).origin;
      url = `${origin}/api/media/file/${encodeURIComponent(storedName)}`;
    }

    const mediaTitle =
      mediaType === "document"
        ? file.name.replace(/\.pdf$/i, "").trim() || file.name
        : null;

    return NextResponse.json({
      url,
      mediaType,
      mediaTitle,
      filename: file.name,
      size: file.size,
      contentType: mime,
      provider: hasBlobToken() ? "blob" : "local",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
