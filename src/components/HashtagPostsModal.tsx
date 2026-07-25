"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import {
  formatCalendarDate,
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
};

type HashtagPostsModalProps = {
  tag: string;
  posts: HashtagPostSummary[];
  onClose: () => void;
};

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

export function HashtagPostsModal({
  tag,
  posts,
  onClose,
}: HashtagPostsModalProps) {
  const router = useRouter();
  const label = formatHashtagLabel(tag);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hashtag-modal-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(32rem,85vh)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
          <div>
            <h2
              id="hashtag-modal-title"
              className="text-base font-semibold text-[var(--ink)]"
            >
              Posts with {label}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {posts.length} {posts.length === 1 ? "post" : "posts"}
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

        <ul className="overflow-y-auto py-1">
          {posts.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-[var(--muted)]">
              No posts use this hashtag.
            </li>
          )}
          {posts.map((post) => (
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
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--ink)]">
                  {postLabel(post)}
                </span>
                <span className="shrink-0 text-xs text-[var(--muted)]">
                  {post.status}
                  <span className="mx-1.5 text-[var(--line)]">·</span>
                  {postDate(post)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
