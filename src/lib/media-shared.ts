/** Client-safe media helpers (no Node imports). */

export const MEDIA_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "application/pdf",
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

/** Soft cap for server FormData uploads (Vercel body limit is ~4.5MB). */
export const MEDIA_SERVER_MAX_BYTES = 4 * 1024 * 1024;
/** Blob client uploads can be larger (LinkedIn-friendly). */
export const MEDIA_BLOB_MAX_BYTES = 100 * 1024 * 1024;

export type ComposerMediaType = "image" | "video" | "document";

export function inferMediaType(
  mime: string,
  filename?: string,
): ComposerMediaType | null {
  const m = mime.toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m === "application/pdf") return "document";
  const ext = (filename ?? "").toLowerCase().split(".").pop();
  if (ext === "pdf") return "document";
  if (["png", "jpg", "jpeg", "gif", "webp", "avif"].includes(ext ?? "")) {
    return "image";
  }
  if (["mp4", "webm", "mov"].includes(ext ?? "")) return "video";
  return null;
}

export function sanitizeUploadFilename(name: string) {
  const base = name.split(/[/\\]/).pop() ?? name;
  const cleaned = base.replace(/[^\w.\-()+ ]+/g, "_").trim();
  return (cleaned || "upload").slice(0, 120);
}
