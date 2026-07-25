import path from "node:path";
import { randomUUID } from "node:crypto";
import { sanitizeUploadFilename } from "@/lib/media-shared";

export {
  MEDIA_ALLOWED_TYPES,
  MEDIA_BLOB_MAX_BYTES,
  MEDIA_SERVER_MAX_BYTES,
  inferMediaType,
  sanitizeUploadFilename,
  type ComposerMediaType,
} from "@/lib/media-shared";

export function buildStoredFilename(originalName: string) {
  const safe = sanitizeUploadFilename(originalName);
  return `${randomUUID()}-${safe}`;
}

export function uploadsDir() {
  return path.join(process.cwd(), "data", "uploads");
}

export function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

export function mediaProvider(): "blob" | "local" {
  return hasBlobToken() ? "blob" : "local";
}
