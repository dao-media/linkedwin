"use client";

import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  ImageIcon,
  Video,
  X,
} from "lucide-react";

export type MediaLightboxItem = {
  mediaType?: string | null;
  mediaUrl?: string | null;
  mediaTitle?: string | null;
  title?: string | null;
};

function isPdfUrl(url: string) {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return path.endsWith(".pdf");
  } catch {
    return url.toLowerCase().includes(".pdf");
  }
}

export function resolveMediaKind(item: MediaLightboxItem) {
  const mediaKind = (item.mediaType ?? "").toLowerCase();
  const url = item.mediaUrl?.trim() || "";
  const isDoc =
    mediaKind === "document" ||
    mediaKind === "doc" ||
    mediaKind === "pdf" ||
    (url ? isPdfUrl(url) : false);
  const isImage =
    mediaKind === "image" ||
    mediaKind === "gif" ||
    /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(url);
  const isVideo =
    mediaKind === "video" || /\.(mp4|webm|mov)(\?|$)/i.test(url);
  const isLink =
    Boolean(url) && !isDoc && !isImage && !isVideo;
  return { url, isDoc, isImage, isVideo, isLink, mediaKind };
}

export function MediaThumbButton({
  item,
  onOpen,
}: {
  item: MediaLightboxItem;
  onOpen: () => void;
}) {
  const { url, isDoc, isImage, isVideo, isLink } = resolveMediaKind(item);
  const label =
    item.mediaTitle?.trim() || item.title?.trim() || "Open media";

  if (!url && !item.mediaType) {
    return <span className="text-[var(--muted)]">—</span>;
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`View media: ${label}`}
      className="group relative size-12 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--bg)] text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
    >
      {isImage && url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className="size-full object-cover"
        />
      ) : isVideo ? (
        <span className="flex size-full items-center justify-center bg-black/80 text-white">
          <Video className="size-5" strokeWidth={1.2} aria-hidden />
        </span>
      ) : isDoc ? (
        <span className="flex size-full items-center justify-center">
          <FileText className="size-5" strokeWidth={1.2} aria-hidden />
        </span>
      ) : isLink ? (
        <span className="flex size-full items-center justify-center">
          <ExternalLink className="size-4" strokeWidth={1.2} aria-hidden />
        </span>
      ) : (
        <span className="flex size-full items-center justify-center">
          <ImageIcon className="size-5" strokeWidth={1.2} aria-hidden />
        </span>
      )}
      <span className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
    </button>
  );
}

export function MediaLightbox({
  item,
  onClose,
}: {
  item: MediaLightboxItem;
  onClose: () => void;
}) {
  const { url, isDoc, isImage, isVideo, isLink } = resolveMediaKind(item);
  const title =
    item.mediaTitle?.trim() || item.title?.trim() || "Media";
  const [pdfPage, setPdfPage] = useState(1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (isDoc && isPdfUrl(url) && e.key === "ArrowLeft") {
        setPdfPage((p) => Math.max(1, p - 1));
      }
      if (isDoc && isPdfUrl(url) && e.key === "ArrowRight") {
        setPdfPage((p) => p + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isDoc, onClose, url]);

  const pdfSrc =
    url && isPdfUrl(url) ? `${url.split("#")[0]}#page=${pdfPage}` : url;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/85"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          <p className="type-h5 truncate">{title}</p>
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="type-p-s inline-flex items-center gap-1 text-white/70 hover:text-white"
            >
              Open original
              <ExternalLink className="size-3" strokeWidth={1.2} aria-hidden />
            </a>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {isDoc && url && isPdfUrl(url) ? (
            <div className="mr-2 flex items-center gap-1">
              <button
                type="button"
                className="inline-flex size-8 items-center justify-center rounded-md border border-white/20 text-white hover:bg-white/10"
                onClick={() => setPdfPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" strokeWidth={1.2} aria-hidden />
              </button>
              <span className="type-p-s min-w-12 text-center text-white/80">
                p. {pdfPage}
              </span>
              <button
                type="button"
                className="inline-flex size-8 items-center justify-center rounded-md border border-white/20 text-white hover:bg-white/10"
                onClick={() => setPdfPage((p) => p + 1)}
                aria-label="Next page"
              >
                <ChevronRight className="size-4" strokeWidth={1.2} aria-hidden />
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-md border border-white/20 text-white hover:bg-white/10"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="size-4" strokeWidth={1.2} aria-hidden />
          </button>
        </div>
      </div>

      <div
        className="flex min-h-0 flex-1 items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {isImage && url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={title}
            className="max-h-full max-w-full object-contain"
          />
        ) : isVideo && url ? (
          <video
            src={url}
            controls
            autoPlay
            className="max-h-full max-w-full bg-black"
            preload="metadata"
          />
        ) : isDoc && url && isPdfUrl(url) ? (
          <iframe
            key={pdfSrc}
            title={title}
            src={pdfSrc}
            className="h-full w-full max-w-5xl rounded-lg bg-white"
          />
        ) : isDoc ? (
          <div className="max-w-md rounded-xl bg-white px-8 py-10 text-center">
            <FileText
              className="mx-auto size-12 text-[var(--muted)]"
              strokeWidth={1.2}
              aria-hidden
            />
            <p className="type-h5 mt-3 text-[var(--ink)]">
              {title}
            </p>
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="type-btn-m mt-3 inline-flex items-center gap-1 text-[var(--accent)] hover:underline"
              >
                Open document
                <ExternalLink className="size-3.5" strokeWidth={1.2} aria-hidden />
              </a>
            ) : (
              <p className="type-p-s mt-2 text-[var(--muted)]">
                No document URL available
              </p>
            )}
          </div>
        ) : isLink && url ? (
          <div className="max-w-md rounded-xl bg-white px-8 py-10 text-center">
            <ExternalLink
              className="mx-auto size-12 text-[var(--muted)]"
              strokeWidth={1.2}
              aria-hidden
            />
            <p className="type-h5 mt-3 break-all text-[var(--ink)]">
              {url}
            </p>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="type-btn-m mt-3 inline-flex items-center gap-1 text-[var(--accent)] hover:underline"
            >
              Open link
              <ExternalLink className="size-3.5" strokeWidth={1.2} aria-hidden />
            </a>
          </div>
        ) : (
          <p className="type-p-m text-white/70">No media to display</p>
        )}
      </div>
    </div>
  );
}
