"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  HashtagPostsModal,
  type HashtagPostSummary,
} from "@/components/HashtagPostsModal";
import { HashtagTag } from "@/components/HashtagTag";
import {
  MediaLightbox,
  MediaThumbButton,
  type MediaLightboxItem,
} from "@/components/MediaLightbox";
import {
  extractHashtags,
  formatCompactNumber,
  formatHashtagLabel,
  formatLibraryDateTime,
  formatMonthLabel,
  postHasHashtag,
  postMonthKey,
  truncateCaption,
} from "@/lib/calendar-format";
import { ExternalLink } from "lucide-react";

export type ContentLibraryRow = {
  id: string;
  title: string | null;
  content: string;
  status: string;
  publishedAt: string | null;
  scheduledFor: string | null;
  createdAt: string;
  mediaType: string | null;
  mediaUrl: string | null;
  mediaTitle?: string | null;
  linkedinPostUrl?: string | null;
  topics?: string;
  impressions: number | null;
  engRate: number | null;
  engagements: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  sends: number | null;
  reposts: number | null;
  followersAtPublish: number | null;
};

const ALL = "all";

function toHashtagSummary(row: ContentLibraryRow): HashtagPostSummary {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    status: row.status,
    topics: row.topics ?? "[]",
    scheduledFor: row.scheduledFor,
    publishedAt: row.publishedAt,
    impressions: row.impressions,
  };
}

export function ContentLibraryView({
  rows,
  highlightId,
  highlightTag,
}: {
  rows: ContentLibraryRow[];
  highlightId?: string | null;
  highlightTag?: string | null;
}) {
  const highlightRef = useRef<HTMLTableRowElement | null>(null);
  const [month, setMonth] = useState<string>(ALL);
  const [lightbox, setLightbox] = useState<MediaLightboxItem | null>(null);
  const [activeHighlightId, setActiveHighlightId] = useState(highlightId);
  const [activeHashtag, setActiveHashtag] = useState<string | null>(null);

  if (highlightId !== activeHighlightId) {
    setActiveHighlightId(highlightId);
    if (highlightId) {
      const hit = rows.find((r) => r.id === highlightId);
      const key = hit ? postMonthKey(hit) : null;
      if (key) setMonth(key);
    }
  }

  const months = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const key = postMonthKey(row);
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, count]) => ({ key, count, label: formatMonthLabel(key) }));
  }, [rows]);

  const filtered = useMemo(() => {
    if (month === ALL) return rows;
    return rows.filter((row) => postMonthKey(row) === month);
  }, [month, rows]);

  const matchingHashtagPosts = useMemo(() => {
    if (!activeHashtag) return [];
    return rows
      .filter((r) => postHasHashtag(r.content, r.topics ?? "[]", activeHashtag))
      .map(toHashtagSummary);
  }, [activeHashtag, rows]);

  /** Delta vs chronologically previous post (older → newer). */
  const followerDeltaById = useMemo(() => {
    const chronological = [...rows]
      .map((row) => ({
        id: row.id,
        followers: row.followersAtPublish,
        key: row.publishedAt || row.scheduledFor || row.createdAt || "",
      }))
      .filter((row) => Boolean(row.key))
      .sort((a, b) => a.key.localeCompare(b.key));

    const map = new Map<string, number | null>();
    let prevFollowers: number | null = null;
    for (const row of chronological) {
      if (row.followers == null) {
        map.set(row.id, null);
        continue;
      }
      map.set(
        row.id,
        prevFollowers == null ? null : row.followers - prevFollowers,
      );
      prevFollowers = row.followers;
    }
    return map;
  }, [rows]);

  useEffect(() => {
    if (!highlightId || !highlightRef.current) return;
    highlightRef.current.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [highlightId, month, filtered]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted)]">
        Browse by month or view all posts
        {highlightId && highlightTag ? (
          <>
            {" "}
            · Showing post from{" "}
            <HashtagTag
              tag={highlightTag}
              emphasized
              onClick={(tag) => setActiveHashtag(formatHashtagLabel(tag))}
            />
          </>
        ) : null}
      </p>

      <div className="flex min-h-0 flex-col gap-4 lg:flex-row lg:items-start">
        <nav
          className="w-full shrink-0 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2 lg:w-52"
          aria-label="Filter by month"
        >
          <MonthNavButton
            active={month === ALL}
            label="All Posts"
            count={rows.length}
            onClick={() => setMonth(ALL)}
          />
          {months.map((m) => (
            <MonthNavButton
              key={m.key}
              active={month === m.key}
              label={m.label}
              count={m.count}
              onClick={() => setMonth(m.key)}
            />
          ))}
          {months.length === 0 && (
            <p className="px-3 py-4 text-xs text-[var(--muted)]">
              No dated posts yet.
            </p>
          )}
        </nav>

        <div className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)]">
          <table className="w-full min-w-[88rem] text-left text-sm">
            <thead className="bg-[var(--bg)] text-[var(--muted)]">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">
                  Date &amp; time
                </th>
                <th className="w-[4.5rem] px-4 py-3 text-left font-semibold">
                  Media
                </th>
                <th className="w-[8.75rem] max-w-[8.75rem] px-4 py-3 text-left font-semibold">
                  Post caption
                </th>
                <th className="min-w-[10rem] px-4 py-3 text-left font-semibold">
                  Hashtags
                </th>
                <th className="px-4 py-3 text-left font-semibold">
                  Impressions
                </th>
                <th className="px-4 py-3 text-left font-semibold">Eng. rate</th>
                <th className="px-4 py-3 text-left font-semibold">
                  Engagements
                </th>
                <th className="px-4 py-3 text-left font-semibold">Likes</th>
                <th className="px-4 py-3 text-left font-semibold">Reposts</th>
                <th className="px-4 py-3 text-left font-semibold">Comments</th>
                <th className="px-4 py-3 text-left font-semibold">Saves</th>
                <th className="px-4 py-3 text-left font-semibold">Sends</th>
                <th className="px-4 py-3 text-left font-semibold">Followers</th>
                <th className="px-4 py-3 text-left font-semibold">Post</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const highlighted = highlightId === row.id;
                const when = formatLibraryDateTime(
                  row.publishedAt || row.scheduledFor || row.createdAt,
                );
                const engRate =
                  row.engRate != null ? `${row.engRate.toFixed(1)}%` : "—";
                const mediaItem: MediaLightboxItem = {
                  mediaType: row.mediaType,
                  mediaUrl: row.mediaUrl,
                  mediaTitle: row.mediaTitle,
                  title: row.title,
                };
                const hashtags = extractHashtags(
                  row.content,
                  row.topics ?? "[]",
                );
                const followerDelta = followerDeltaById.get(row.id) ?? null;
                return (
                  <tr
                    key={row.id}
                    id={`post-${row.id}`}
                    ref={highlighted ? highlightRef : undefined}
                    className={`border-t border-[var(--line)] ${
                      highlighted ? "bg-[var(--accent-soft)]" : ""
                    }`}
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-left">
                      {when ? (
                        <div>
                          <div>{when.date}</div>
                          <div className="text-xs text-[var(--muted)]">
                            {when.time}
                          </div>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-left">
                      <MediaThumbButton
                        item={mediaItem}
                        onOpen={() => setLightbox(mediaItem)}
                      />
                    </td>
                    <td
                      className="w-[8.75rem] max-w-[8.75rem] truncate px-4 py-3 text-left"
                      title={row.title || row.content}
                    >
                      {truncateCaption(row.title || row.content) || "—"}
                    </td>
                    <td className="max-w-[14rem] px-4 py-3 text-left">
                      {hashtags.length ? (
                        <div className="flex flex-wrap gap-1">
                          {hashtags.slice(0, 6).map((tag) => (
                            <HashtagTag
                              key={tag}
                              tag={tag}
                              onClick={(t) =>
                                setActiveHashtag(formatHashtagLabel(t))
                              }
                            />
                          ))}
                          {hashtags.length > 6 ? (
                            <span className="text-xs text-[var(--muted)]">
                              +{hashtags.length - 6}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-[var(--muted)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-left">
                      {formatCompactNumber(row.impressions)}
                    </td>
                    <td className="px-4 py-3 text-left">{engRate}</td>
                    <td className="px-4 py-3 text-left">
                      {formatCompactNumber(row.engagements)}
                    </td>
                    <td className="px-4 py-3 text-left">
                      {formatCompactNumber(row.likes)}
                    </td>
                    <td className="px-4 py-3 text-left">
                      {formatCompactNumber(row.reposts)}
                    </td>
                    <td className="px-4 py-3 text-left">
                      {formatCompactNumber(row.comments)}
                    </td>
                    <td className="px-4 py-3 text-left">
                      {formatCompactNumber(row.saves)}
                    </td>
                    <td className="px-4 py-3 text-left">
                      {formatCompactNumber(row.sends)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-left">
                      {row.followersAtPublish == null ? (
                        "—"
                      ) : (
                        <div>
                          <div className="tabular-nums">
                            {row.followersAtPublish.toLocaleString()}
                          </div>
                          <FollowerDelta delta={followerDelta} />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-left">
                      {row.linkedinPostUrl ? (
                        <a
                          href={row.linkedinPostUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline"
                        >
                          Open
                          <ExternalLink
                            className="size-3"
                            strokeWidth={1.2}
                            aria-hidden
                          />
                        </a>
                      ) : (
                        <span className="text-[var(--muted)]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={14}
                    className="px-4 py-10 text-center text-[var(--muted)]"
                  >
                    No posts in this view yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {lightbox ? (
        <MediaLightbox
          key={lightbox.mediaUrl ?? lightbox.title ?? "media"}
          item={lightbox}
          onClose={() => setLightbox(null)}
        />
      ) : null}
      {activeHashtag ? (
        <HashtagPostsModal
          tag={activeHashtag}
          posts={matchingHashtagPosts}
          onClose={() => setActiveHashtag(null)}
        />
      ) : null}
    </div>
  );
}

function FollowerDelta({ delta }: { delta: number | null }) {
  if (delta == null) {
    return (
      <div className="text-xs text-[var(--muted)]" title="No previous post">
        —
      </div>
    );
  }
  if (delta === 0) {
    return (
      <div className="text-xs font-medium text-[var(--muted)]" title="No change">
        ±0
      </div>
    );
  }
  const up = delta > 0;
  return (
    <div
      className={`text-xs font-semibold tabular-nums ${
        up ? "text-[var(--success)]" : "text-red-600"
      }`}
      title={`${up ? "Up" : "Down"} ${Math.abs(delta).toLocaleString()} since previous post`}
    >
      {up ? "+" : "−"}
      {Math.abs(delta).toLocaleString()}
    </div>
  );
}

function MonthNavButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mb-1 flex h-10 w-full items-center justify-between gap-2 rounded-lg border pl-3 pr-3 text-left text-sm transition last:mb-0 ${
        active
          ? "border-[var(--accent)] bg-[var(--accent-soft)] font-semibold text-[var(--accent)]"
          : "border-transparent font-medium text-[var(--ink)] hover:bg-[var(--bg)]"
      }`}
    >
      <span className="truncate">{label}</span>
      <span
        className={`shrink-0 text-xs ${
          active ? "text-[var(--accent)]" : "text-[var(--muted)]"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
