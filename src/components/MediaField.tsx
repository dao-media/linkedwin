"use client";

import { useEffect, useId, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import {
  FileText,
  Image as ImageIcon,
  Link2,
  Loader2,
  Upload,
  Video,
  X,
} from "lucide-react";
import { inferMediaType, type ComposerMediaType } from "@/lib/media-shared";

type MediaSource = "upload" | "url";

type Props = {
  mediaType: ComposerMediaType | "";
  mediaUrl: string;
  mediaTitle: string;
  onChange: (next: {
    mediaType: ComposerMediaType | "";
    mediaUrl: string;
    mediaTitle: string;
  }) => void;
};

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaField({
  mediaType,
  mediaUrl,
  mediaTitle,
  onChange,
}: Props) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<MediaSource>(
    mediaUrl ? "url" : "upload",
  );
  const [provider, setProvider] = useState<"blob" | "local" | null>(null);
  const [maxBytes, setMaxBytes] = useState(4 * 1024 * 1024);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/media/config")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setProvider(data.provider === "blob" ? "blob" : "local");
        if (typeof data.maxBytes === "number") setMaxBytes(data.maxBytes);
      })
      .catch(() => {
        if (!cancelled) setProvider("local");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function clearMedia() {
    setFileLabel(null);
    setUploadError(null);
    onChange({ mediaType: "", mediaUrl: "", mediaTitle: "" });
    if (fileRef.current) fileRef.current.value = "";
  }

  async function uploadFile(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      if (file.size > maxBytes) {
        throw new Error(
          `File is too large (max ${formatBytes(maxBytes)}).${
            provider !== "blob"
              ? " Set BLOB_READ_WRITE_TOKEN for larger uploads."
              : ""
          }`,
        );
      }

      let url: string;
      let nextType: ComposerMediaType | "";
      let nextTitle: string;

      if (provider === "blob") {
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/media/blob",
        });
        url = blob.url;
        nextType = inferMediaType(file.type, file.name) ?? "";
        nextTitle =
          nextType === "document"
            ? file.name.replace(/\.pdf$/i, "").trim() || file.name
            : mediaTitle;
      } else {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/media/upload", {
          method: "POST",
          body: fd,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            typeof data.error === "string" ? data.error : "Upload failed",
          );
        }
        url = data.url as string;
        nextType = (data.mediaType as ComposerMediaType) || "";
        nextTitle =
          typeof data.mediaTitle === "string" && data.mediaTitle
            ? data.mediaTitle
            : mediaTitle;
      }

      if (!nextType) {
        nextType = inferMediaType(file.type, file.name) ?? "image";
      }

      setFileLabel(file.name);
      setSource("upload");
      onChange({
        mediaType: nextType,
        mediaUrl: url,
        mediaTitle: nextType === "document" ? nextTitle : "",
      });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function onFilePicked(file: File | undefined | null) {
    if (!file) return;
    void uploadFile(file);
  }

  const previewKind = mediaType || inferMediaType("", mediaUrl) || "";

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="type-label-m text-[var(--muted)]">Media</h3>
        <div className="flex rounded-lg border border-[var(--line)] p-0.5">
          <button
            type="button"
            onClick={() => setSource("upload")}
            className={`type-btn-s rounded-md px-2.5 py-1 transition ${
              source === "upload"
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            Upload file
          </button>
          <button
            type="button"
            onClick={() => setSource("url")}
            className={`type-btn-s rounded-md px-2.5 py-1 transition ${
              source === "url"
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            Hosted URL
          </button>
        </div>
      </div>

      {source === "upload" ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            onFilePicked(e.dataTransfer.files?.[0]);
          }}
          className={`rounded-xl border border-dashed px-4 py-6 text-center transition ${
            dragOver
              ? "border-[var(--accent)] bg-[var(--accent-soft)]"
              : "border-[var(--line)] bg-[var(--bg)]"
          }`}
        >
          <input
            ref={fileRef}
            id={inputId}
            type="file"
            accept="image/*,video/mp4,video/webm,video/quicktime,application/pdf,.pdf"
            className="sr-only"
            disabled={uploading}
            onChange={(e) => onFilePicked(e.target.files?.[0])}
          />
          {uploading ? (
            <div className="type-label-l inline-flex items-center gap-2 text-[var(--muted)]">
              <Loader2 className="size-4 animate-spin" strokeWidth={1.2} />
              Uploading…
            </div>
          ) : mediaUrl && fileLabel ? (
            <div className="flex flex-col items-center gap-2">
              <MediaKindIcon kind={previewKind} />
              <p className="type-h5 text-[var(--ink)]">
                {fileLabel}
              </p>
              <p className="type-p-s max-w-full truncate text-[var(--muted)]">
                {mediaUrl}
              </p>
              <div className="mt-1 flex gap-2">
                <label
                  htmlFor={inputId}
                  className="type-btn-s cursor-pointer rounded-md border border-[var(--line)] bg-white px-2.5 py-1 text-[var(--ink)] hover:border-[var(--accent)]"
                >
                  Replace
                </label>
                <button
                  type="button"
                  onClick={clearMedia}
                  className="type-btn-s inline-flex items-center gap-1 rounded-md border border-[var(--line)] bg-white px-2.5 py-1 text-[var(--muted)] hover:border-[#c0392b] hover:text-[#c0392b]"
                >
                  <X className="size-3.5" strokeWidth={1.2} aria-hidden />
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <>
              <Upload
                className="mx-auto size-8 text-[var(--muted)]"
                strokeWidth={1.2}
                aria-hidden
              />
              <p className="type-label-l mt-2 text-[var(--ink)]">
                Drop an image, PDF, or video here
              </p>
              <p className="type-p-s mt-0.5 text-[var(--muted)]">
                Max {formatBytes(maxBytes)}
                {provider === "local"
                  ? " · local storage (set BLOB_READ_WRITE_TOKEN for cloud)"
                  : " · Vercel Blob"}
              </p>
              <label
                htmlFor={inputId}
                className="type-btn-s mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-white hover:opacity-90"
              >
                Choose file
              </label>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          <label className="type-p-m block">
            <span className="type-label-m mb-1 block text-[var(--muted)]">
              Media type
            </span>
            <select
              className="type-p-m w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
              value={mediaType}
              onChange={(e) =>
                onChange({
                  mediaType: e.target.value as ComposerMediaType | "",
                  mediaUrl,
                  mediaTitle,
                })
              }
            >
              <option value="">None</option>
              <option value="image">Image</option>
              <option value="video">Video</option>
              <option value="document">Document (PDF)</option>
            </select>
          </label>
          <label className="type-p-m block md:col-span-2">
            <span className="type-label-m mb-1 flex items-center gap-1 text-[var(--muted)]">
              <Link2 className="size-3.5" strokeWidth={1.2} aria-hidden />
              Hosted media URL
            </span>
            <input
              className="type-p-m w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
              value={mediaUrl}
              onChange={(e) =>
                onChange({
                  mediaType,
                  mediaUrl: e.target.value,
                  mediaTitle,
                })
              }
              placeholder="https://..."
            />
          </label>
        </div>
      )}

      {(mediaType === "document" ||
        (source === "upload" && previewKind === "document")) && (
        <label className="type-p-m block">
          <span className="type-label-m mb-1 block text-[var(--muted)]">
            Document title
          </span>
          <input
            className="type-p-m w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
            value={mediaTitle}
            onChange={(e) =>
              onChange({
                mediaType: mediaType || "document",
                mediaUrl,
                mediaTitle: e.target.value,
              })
            }
            placeholder="Shown on the LinkedIn document card"
          />
        </label>
      )}

      {source === "upload" && mediaUrl && !fileLabel ? (
        <p className="type-p-s truncate text-[var(--muted)]">
          Attached: {mediaUrl}
        </p>
      ) : null}

      {uploadError ? (
        <p className="type-p-m text-red-600">{uploadError}</p>
      ) : null}
    </section>
  );
}

function MediaKindIcon({ kind }: { kind: string }) {
  if (kind === "video") {
    return <Video className="size-8 text-[var(--accent)]" strokeWidth={1.2} />;
  }
  if (kind === "document") {
    return (
      <FileText className="size-8 text-[var(--accent)]" strokeWidth={1.2} />
    );
  }
  return (
    <ImageIcon className="size-8 text-[var(--accent)]" strokeWidth={1.2} />
  );
}
