"use client";

import { useMemo, useState } from "react";
import {
  HashtagPostsModal,
  type HashtagPostSummary,
} from "@/components/HashtagPostsModal";
import { HashtagTag } from "@/components/HashtagTag";
import {
  formatCompactNumber,
  formatHashtagLabel,
  postHasHashtag,
} from "@/lib/calendar-format";

export type OverviewHashtagRow = {
  tag: string;
  posts: number;
  avgImpressions: number;
};

type OverviewTopHashtagsProps = {
  rows: OverviewHashtagRow[];
  posts: HashtagPostSummary[];
};

export function OverviewTopHashtags({ rows, posts }: OverviewTopHashtagsProps) {
  const [activeHashtag, setActiveHashtag] = useState<string | null>(null);

  const matchingPosts = useMemo(() => {
    if (!activeHashtag) return [];
    return posts.filter((p) =>
      postHasHashtag(p.content, p.topics ?? "[]", activeHashtag),
    );
  }, [activeHashtag, posts]);

  function openHashtag(tag: string) {
    setActiveHashtag(formatHashtagLabel(tag));
  }

  return (
    <>
      <ul className="max-h-44 divide-y divide-[var(--line)] overflow-y-auto">
        {rows.length === 0 && (
          <li className="py-2 type-p-m text-[var(--muted)]">
            No hashtag data yet
          </li>
        )}
        {rows.map((row, i) => (
          <li
            key={row.tag}
            className="flex items-center gap-3 py-2.5 type-p-m"
          >
            <span className="w-6 shrink-0 type-label-m text-[var(--muted)]">
              {i + 1}
            </span>
            <HashtagTag tag={row.tag} onClick={openHashtag} />
            <button
              type="button"
              className="ml-auto shrink-0 type-p-s text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
              onClick={() => openHashtag(row.tag)}
            >
              {formatCompactNumber(row.avgImpressions)} avg impr · {row.posts}{" "}
              posts
            </button>
          </li>
        ))}
      </ul>
      {activeHashtag ? (
        <HashtagPostsModal
          tag={activeHashtag}
          posts={matchingPosts}
          onClose={() => setActiveHashtag(null)}
        />
      ) : null}
    </>
  );
}
