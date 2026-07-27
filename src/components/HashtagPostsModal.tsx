"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  formatCalendarDate,
  formatCompactNumber,
  formatHashtagLabel,
} from "@/lib/calendar-format";

export type HashtagPostSummary = {
  id: string;
  title: string | null;
  content: string;
  status: string;
  topics: string;
  scheduledFor: string | null;
  publishedAt: string | null;
  impressions?: number | null;
};

type HashtagPostsModalProps = {
  tag: string;
  posts: HashtagPostSummary[];
  onClose: () => void;
};

const PAGE_SIZE = 25;

function postLabel(post: HashtagPostSummary) {
  const raw = post.title?.trim() || post.content.trim();
  if (!raw) return "Untitled post";
  return raw.length > 72 ? `${raw.slice(0, 72)}…` : raw;
}

function postDate(post: HashtagPostSummary) {
  const iso = post.publishedAt || post.scheduledFor;
  if (!iso) return "—";
  return formatCalendarDate(new Date(iso));
}

function impressionsOf(post: HashtagPostSummary) {
  return post.impressions ?? 0;
}

export function HashtagPostsModal({
  tag,
  posts,
  onClose,
}: HashtagPostsModalProps) {
  const router = useRouter();
  const label = formatHashtagLabel(tag);
  const [page, setPage] = useState(0);
  const [pageTag, setPageTag] = useState(tag);
  if (tag !== pageTag) {
    setPageTag(tag);
    setPage(0);
  }

  const sorted = useMemo(() => {
    return [...posts].sort((a, b) => {
      const diff = impressionsOf(b) - impressionsOf(a);
      if (diff !== 0) return diff;
      const aKey = a.publishedAt || a.scheduledFor || "";
      const bKey = b.publishedAt || b.scheduledFor || "";
      return bKey.localeCompare(aKey);
    });
  }, [posts]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const safePage = Math.min(page, totalPages - 1);
  const pagePosts = sorted.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );
  const from = sorted.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const to = Math.min(sorted.length, (safePage + 1) * PAGE_SIZE);

  return (
    <div
      data-calendar-interactive
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hashtag-modal-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(36rem,90vh)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
          <div>
            <h2
              id="hashtag-modal-title"
              className="type-h3 text-[var(--ink)]"
            >
              Posts with {label}
            </h2>
            <p className="type-p-s mt-0.5 text-[var(--muted)]">
              {sorted.length} {sorted.length === 1 ? "post" : "posts"} · sorted
              by impressions
            </p>
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--ink)]"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="size-4" strokeWidth={1.2} aria-hidden />
          </button>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto py-1">
          {pagePosts.length === 0 && (
            <li className="type-p-m px-5 py-8 text-center text-[var(--muted)]">
              No posts use this hashtag.
            </li>
          )}
          {pagePosts.map((post) => (
            <li key={post.id}>
              <button
                type="button"
                className="flex w-full items-baseline justify-between gap-4 px-5 py-3 text-left transition hover:bg-[var(--accent-soft)]"
                onClick={() => {
                  onClose();
                  const params = new URLSearchParams({
                    post: post.id,
                    tag: label,
                  });
                  router.push(`/repository?${params.toString()}`);
                }}
              >
                <span className="type-label-l min-w-0 flex-1 truncate text-[var(--ink)]">
                  {postLabel(post)}
                </span>
                <span className="type-p-s shrink-0 text-right text-[var(--muted)]">
                  <span className="type-label-s tabular-nums text-[var(--ink)]">
                    {formatCompactNumber(post.impressions)}
                  </span>
                  <span className="mx-1.5 text-[var(--line)]">·</span>
                  {postDate(post)}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {sorted.length > PAGE_SIZE ? (
          <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] px-5 py-3">
            <p className="type-p-s text-[var(--muted)]">
              {from}–{to} of {sorted.length}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={safePage <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="inline-flex size-8 items-center justify-center rounded-md border border-[var(--line)] text-[var(--ink)] disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" strokeWidth={1.2} />
              </button>
              <span className="type-p-s min-w-[4.5rem] text-center text-[var(--muted)]">
                {safePage + 1} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages - 1}
                onClick={() =>
                  setPage((p) => Math.min(totalPages - 1, p + 1))
                }
                className="inline-flex size-8 items-center justify-center rounded-md border border-[var(--line)] text-[var(--ink)] disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="size-4" strokeWidth={1.2} />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
