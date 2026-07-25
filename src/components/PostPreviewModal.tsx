"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Link2,
  Video,
  X,
} from "lucide-react";
import { extractHashtags, formatCompactNumber } from "@/lib/calendar-format";
import { HashtagTag } from "@/components/HashtagTag";

/** Matches Figma calendar post-preview-card (552×553). */
const CARD_WIDTH_CLASS = "w-full max-w-[34.5rem]";
const CARD_HEIGHT_CLASS = "h-[min(34.5625rem,92vh)]";

export type PostPreviewData = {
  id: string;
  title: string | null;
  content: string;
  /** Optional distinct sign-off / footer block below the caption */
  footer?: string | null;
  mediaType?: string | null;
  mediaUrl?: string | null;
  mediaTitle?: string | null;
  firstComment?: string | null;
  secondComment?: string | null;
  thirdComment?: string | null;
  topics?: string;
  authorName?: string;
  authorHeadline?: string;
};

export type PostPreviewStats = {
  impressions: number;
  engagementRate: number;
  engagements: number;
  likes: number;
  comments: number;
  saves: number;
  sends: number;
  reposts: number;
};

type PostPreviewModalProps = {
  post: PostPreviewData;
  onClose: () => void;
  /** When set (e.g. Trends leaders), sticky strip above the scroll body. */
  stats?: PostPreviewStats | null;
  onHashtagClick?: (tag: string) => void;
};

function commentList(post: PostPreviewData) {
  return [post.firstComment, post.secondComment, post.thirdComment]
    .map((c) => c?.trim())
    .filter((c): c is string => Boolean(c));
}

function isPdfUrl(url: string) {
  try {
    const path = new URL(url, "https://example.com").pathname.toLowerCase();
    return path.endsWith(".pdf");
  } catch {
    return url.toLowerCase().includes(".pdf");
  }
}

function captionNeedsExpand(text: string) {
  if (text.length > 220) return true;
  return text.split(/\n/).length > 4;
}

function MediaPanel({ post }: { post: PostPreviewData }) {
  const mediaKind = (post.mediaType ?? "").toLowerCase();
  const url = post.mediaUrl?.trim() || "";
  const title =
    post.mediaTitle?.trim() || post.title?.trim() || "Attached media";

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
    mediaKind === "link" || (!isDoc && !isImage && !isVideo && Boolean(url));

  if (isImage && url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={title}
        className="max-h-52 w-full bg-[#f3f2ef] object-contain"
      />
    );
  }

  if (isVideo && url) {
    return (
      <video
        src={url}
        controls
        className="max-h-52 w-full bg-black"
        preload="metadata"
      />
    );
  }

  if (isDoc && url && isPdfUrl(url)) {
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-2 border-b border-[var(--line)] bg-[var(--bg)] px-4 py-2 text-sm">
          <FileText
            className="size-4 shrink-0 text-[var(--accent)]"
            strokeWidth={1.2}
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline"
          >
            Open
            <ExternalLink className="size-3" strokeWidth={1.2} aria-hidden />
          </a>
        </div>
        <iframe
          title={title}
          src={url}
          className="h-52 w-full border-0 bg-[#f3f2ef]"
        />
      </div>
    );
  }

  if (isDoc) {
    return (
      <div className="flex min-h-32 flex-col items-center justify-center gap-2 bg-[#f3f2ef] px-6 py-8 text-center">
        <FileText
          className="size-10 text-[var(--muted)]"
          strokeWidth={1.2}
          aria-hidden
        />
        <p className="text-sm font-medium text-[var(--ink)]">{title}</p>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline"
          >
            Open attachment
            <ExternalLink className="size-3" strokeWidth={1.2} aria-hidden />
          </a>
        ) : (
          <p className="text-xs text-[var(--muted)]">Document attached</p>
        )}
      </div>
    );
  }

  if (isVideo) {
    return (
      <div className="flex min-h-32 flex-col items-center justify-center gap-2 bg-black/90 px-6 py-8 text-center text-white">
        <Video className="size-10 opacity-70" strokeWidth={1.2} aria-hidden />
        <p className="text-sm font-medium">{title}</p>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-[var(--accent-soft)] hover:underline"
          >
            Open video
          </a>
        ) : (
          <p className="text-xs opacity-70">Video attached</p>
        )}
      </div>
    );
  }

  if (isImage) {
    return (
      <div className="flex min-h-32 flex-col items-center justify-center gap-2 bg-[#f3f2ef] px-6 py-8 text-center">
        <ImageIcon
          className="size-10 text-[var(--muted)]"
          strokeWidth={1.2}
          aria-hidden
        />
        <p className="text-sm font-medium text-[var(--ink)]">{title}</p>
        <p className="text-xs text-[var(--muted)]">Image attached</p>
      </div>
    );
  }

  if (url || isLink) {
    return (
      <div className="flex items-start gap-3 bg-[var(--bg)] px-4 py-4">
        <Link2
          className="mt-0.5 size-4 shrink-0 text-[var(--accent)]"
          strokeWidth={1.2}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Link
          </p>
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block break-all text-sm font-semibold text-[var(--accent)] hover:underline"
            >
              {url}
            </a>
          ) : (
            <p className="mt-1 text-sm text-[var(--ink)]">{title}</p>
          )}
        </div>
      </div>
    );
  }

  return null;
}

function StatsStrip({ stats }: { stats: PostPreviewStats }) {
  return (
    <section className="grid shrink-0 grid-cols-4 gap-2 border-b border-[var(--line)] bg-[var(--bg)] px-4 py-3 sm:grid-cols-4 lg:grid-cols-8">
      {(
        [
          ["Impr", formatCompactNumber(stats.impressions)],
          ["Eng %", `${stats.engagementRate.toFixed(1)}%`],
          ["Eng", formatCompactNumber(stats.engagements)],
          ["Likes", formatCompactNumber(stats.likes)],
          ["Comments", formatCompactNumber(stats.comments)],
          ["Saves", formatCompactNumber(stats.saves)],
          ["Sends", formatCompactNumber(stats.sends)],
          ["Reposts", formatCompactNumber(stats.reposts)],
        ] as const
      ).map(([label, value]) => (
        <div key={label} className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            {label}
          </div>
          <div className="truncate text-sm font-bold text-[var(--ink)]">
            {value}
          </div>
        </div>
      ))}
    </section>
  );
}

function CaptionBlock({
  caption,
  hashtags,
  onHashtagClick,
}: {
  caption: string;
  hashtags: string[];
  onHashtagClick?: (tag: string) => void;
}) {
  const canExpand = captionNeedsExpand(caption);
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="border-b border-[var(--line)] px-4 py-3">
      <p
        className={`whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--ink)] ${
          !expanded && canExpand ? "line-clamp-4" : ""
        }`}
      >
        {caption}
      </p>
      {canExpand ? (
        <button
          type="button"
          className="mt-2 text-[13px] font-semibold text-[var(--accent)] hover:underline"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? "Show less" : "See more"}
        </button>
      ) : null}
      {hashtags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {hashtags.map((tag) =>
            onHashtagClick ? (
              <HashtagTag key={tag} tag={tag} onClick={onHashtagClick} />
            ) : (
              <span
                key={tag}
                className="text-[13px] font-medium text-[var(--accent)]"
              >
                {tag}
              </span>
            ),
          )}
        </div>
      ) : null}
    </section>
  );
}

export function PostPreviewModal({
  post,
  onClose,
  stats,
  onHashtagClick,
}: PostPreviewModalProps) {
  const comments = commentList(post);
  const hashtags = useMemo(
    () => extractHashtags(post.content, post.topics ?? "[]"),
    [post.content, post.topics],
  );
  const hasMedia = Boolean(post.mediaUrl?.trim() || post.mediaType?.trim());
  const footer = post.footer?.trim() ?? "";
  const caption = post.content.trim() || "—";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const author = post.authorName ?? "Dane O'Leary";
  const headline = post.authorHeadline ?? "Content ops";
  const initials = author
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-preview-title"
      onClick={onClose}
    >
      <div
        className={`flex ${CARD_HEIGHT_CLASS} ${CARD_WIDTH_CLASS} flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {stats ? <StatsStrip stats={stats} /> : null}

        <header className="flex shrink-0 items-start gap-3 border-b border-[var(--line)] px-4 py-3">
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-sm font-bold text-[var(--accent)]"
            aria-hidden
          >
            {initials || "LW"}
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="post-preview-title"
              className="truncate text-[15px] font-semibold text-[var(--ink)]"
            >
              {author}
            </h2>
            <p className="truncate text-xs text-[var(--muted)]">
              {headline} · Preview
            </p>
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--ink)]"
            onClick={onClose}
            aria-label="Close preview"
          >
            <X className="size-4" strokeWidth={1.2} aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <CaptionBlock
            key={post.id}
            caption={caption}
            hashtags={hashtags}
            onHashtagClick={onHashtagClick}
          />

          {footer ? (
            <section className="border-b border-[var(--line)] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Footer
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--ink)]">
                {footer}
              </p>
            </section>
          ) : null}

          {hasMedia ? (
            <section className="border-b border-[var(--line)]">
              <MediaPanel post={post} />
            </section>
          ) : null}

          {comments.length > 0 ? (
            <section className="px-4 py-3">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Pinned comments
              </p>
              <ul className="space-y-3">
                {comments.map((body, i) => (
                  <li
                    key={`${i}-${body.slice(0, 24)}`}
                    className="flex gap-2.5"
                  >
                    <div
                      className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[10px] font-bold text-[var(--accent)]"
                      aria-hidden
                    >
                      {initials || "LW"}
                    </div>
                    <div className="min-w-0 flex-1 rounded-xl bg-[var(--bg)] px-3 py-2">
                      <p className="text-xs font-semibold text-[var(--ink)]">
                        {author}
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--ink)]">
                        {body}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
