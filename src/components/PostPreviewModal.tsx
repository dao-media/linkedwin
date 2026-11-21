"use client";

import { useEffect, useMemo, useState } from "react";
import { useProfile } from "@/lib/use-profile";
import {
  ChevronLeft,
  ChevronRight,
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
  /** Cycle to the previous post in the current list (wraps). */
  onPrev?: () => void;
  /** Cycle to the next post in the current list (wraps). */
  onNext?: () => void;
  /** Optional counter label, e.g. "3 / 42". */
  positionLabel?: string | null;
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
        className="block h-auto w-full bg-[#f3f2ef] object-contain"
      />
    );
  }

  if (isVideo && url) {
    return (
      <video
        src={url}
        controls
        className="block h-auto w-full bg-black"
        preload="metadata"
      />
    );
  }

  if (isDoc && url && isPdfUrl(url)) {
    return (
      <div className="flex flex-col">
        <div className="type-p-m flex items-center gap-2 border-b border-[var(--line)] bg-[var(--bg)] px-4 py-2">
          <FileText
            className="size-4 shrink-0 text-[var(--accent)]"
            strokeWidth={1.2}
            aria-hidden
          />
          <span className="type-label-l min-w-0 flex-1 truncate">{title}</span>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="type-btn-s inline-flex shrink-0 items-center gap-1 text-[var(--accent)] hover:underline"
          >
            Open
            <ExternalLink className="size-3" strokeWidth={1.2} aria-hidden />
          </a>
        </div>
        <iframe
          title={title}
          src={url}
          className="aspect-[3/4] w-full border-0 bg-[#f3f2ef]"
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
        <p className="type-label-l text-[var(--ink)]">{title}</p>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="type-btn-s inline-flex items-center gap-1 text-[var(--accent)] hover:underline"
          >
            Open attachment
            <ExternalLink className="size-3" strokeWidth={1.2} aria-hidden />
          </a>
        ) : (
          <p className="type-p-s text-[var(--muted)]">Document attached</p>
        )}
      </div>
    );
  }

  if (isVideo) {
    return (
      <div className="flex min-h-32 flex-col items-center justify-center gap-2 bg-black/90 px-6 py-8 text-center text-white">
        <Video className="size-10 opacity-70" strokeWidth={1.2} aria-hidden />
        <p className="type-label-l">{title}</p>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="type-btn-s text-[var(--accent-soft)] hover:underline"
          >
            Open video
          </a>
        ) : (
          <p className="type-p-s opacity-70">Video attached</p>
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
        <p className="type-label-l text-[var(--ink)]">{title}</p>
        <p className="type-p-s text-[var(--muted)]">Image attached</p>
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
          <p className="type-section-l text-[var(--muted)]">
            Link
          </p>
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="type-btn-m mt-1 block break-all text-[var(--accent)] hover:underline"
            >
              {url}
            </a>
          ) : (
            <p className="type-p-m mt-1 text-[var(--ink)]">{title}</p>
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
          <div className="type-section-s text-[var(--muted)]">
            {label}
          </div>
          <div className="type-btn-l truncate text-[var(--ink)]">
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
        className={`type-p-l whitespace-pre-wrap text-[var(--ink)] ${
          !expanded && canExpand ? "line-clamp-4" : ""
        }`}
      >
        {caption}
      </p>
      {canExpand ? (
        <button
          type="button"
          className="type-btn-s mt-2 text-[var(--accent)] hover:underline"
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
                className="type-p-l text-[var(--accent)]"
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
  onPrev,
  onNext,
  positionLabel,
}: PostPreviewModalProps) {
  const comments = commentList(post);
  const hashtags = useMemo(
    () => extractHashtags(post.content, post.topics ?? "[]"),
    [post.content, post.topics],
  );
  const hasMedia = Boolean(post.mediaUrl?.trim() || post.mediaType?.trim());
  const footer = post.footer?.trim() ?? "";
  const caption = post.content.trim() || "—";
  const canCycle = Boolean(onPrev && onNext);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowLeft" && onPrev) {
        e.preventDefault();
        onPrev();
        return;
      }
      if (e.key === "ArrowRight" && onNext) {
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  const profile = useProfile();
  const author = post.authorName ?? profile.name;
  const headline = post.authorHeadline ?? profile.headline;
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
      {canCycle ? (
        <button
          type="button"
          className="type-btn-s absolute left-2 top-1/2 z-10 inline-flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] shadow-md transition-colors hover:bg-[var(--bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] active:scale-[0.98] sm:left-4"
          onClick={(e) => {
            e.stopPropagation();
            onPrev?.();
          }}
          aria-label="Previous post"
        >
          <ChevronLeft className="size-5" strokeWidth={1.4} aria-hidden />
        </button>
      ) : null}

      <div
        className={`flex ${CARD_HEIGHT_CLASS} ${CARD_WIDTH_CLASS} flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {stats ? <StatsStrip stats={stats} /> : null}

        <header className="flex shrink-0 items-start gap-3 border-b border-[var(--line)] px-4 py-3">
          <div
            className="type-btn-l flex size-12 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]"
            aria-hidden
          >
            {initials || "LW"}
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="post-preview-title"
              className="type-h4 truncate text-[var(--ink)]"
            >
              {author}
            </h2>
            <p className="type-p-s truncate text-[var(--muted)]">
              {headline}
              {positionLabel ? ` · ${positionLabel}` : " · Preview"}
            </p>
          </div>
          <button
            type="button"
            className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--bg)] hover:text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] active:scale-[0.98]"
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
              <p className="type-section-m text-[var(--muted)]">
                Footer
              </p>
              <p className="type-p-l mt-1.5 whitespace-pre-wrap text-[var(--ink)]">
                {footer}
              </p>
            </section>
          ) : null}

          {hasMedia ? (
            <section className="border-b border-[var(--line)]">
              <MediaPanel key={`media-${post.id}`} post={post} />
            </section>
          ) : null}

          {comments.length > 0 ? (
            <section className="px-4 py-3">
              <p className="type-section-m mb-3 text-[var(--muted)]">
                Pinned comments
              </p>
              <ul className="space-y-3">
                {comments.map((body, i) => (
                  <li
                    key={`${post.id}-${i}-${body.slice(0, 24)}`}
                    className="flex gap-2.5"
                  >
                    <div
                      className="type-chip mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]"
                      aria-hidden
                    >
                      {initials || "LW"}
                    </div>
                    <div className="min-w-0 flex-1 rounded-xl bg-[var(--bg)] px-3 py-2">
                      <p className="type-label-m text-[var(--ink)]">
                        {author}
                      </p>
                      <p className="type-p-l mt-0.5 whitespace-pre-wrap text-[var(--ink)]">
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

      {canCycle ? (
        <button
          type="button"
          className="type-btn-s absolute right-2 top-1/2 z-10 inline-flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] shadow-md transition-colors hover:bg-[var(--bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] active:scale-[0.98] sm:right-4"
          onClick={(e) => {
            e.stopPropagation();
            onNext?.();
          }}
          aria-label="Next post"
        >
          <ChevronRight className="size-5" strokeWidth={1.4} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
