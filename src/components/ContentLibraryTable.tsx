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
  PostPreviewModal,
  type PostPreviewData,
  type PostPreviewStats,
} from "@/components/PostPreviewModal";
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
import { ExternalLink, Maximize2 } from "lucide-react";

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
  firstComment?: string | null;
  secondComment?: string | null;
  thirdComment?: string | null;
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

function toPreviewPost(row: ContentLibraryRow): PostPreviewData {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    mediaType: row.mediaType,
    mediaUrl: row.mediaUrl,
    mediaTitle: row.mediaTitle,
    firstComment: row.firstComment,
    secondComment: row.secondComment,
    thirdComment: row.thirdComment,
    topics: row.topics,
  };
}

function toPreviewStats(row: ContentLibraryRow): PostPreviewStats | null {
  if (
    row.impressions == null &&
    row.engagements == null &&
    row.likes == null &&
    row.comments == null
  ) {
    return null;
  }
  return {
    impressions: row.impressions ?? 0,
    engagementRate: row.engRate ?? 0,
    engagements: row.engagements ?? 0,
    likes: row.likes ?? 0,
    comments: row.comments ?? 0,
    saves: row.saves ?? 0,
    sends: row.sends ?? 0,
    reposts: row.reposts ?? 0,
  };
}

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
  const [previewId, setPreviewId] = useState<string | null>(null);
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

  const previewIndex = useMemo(() => {
    if (!previewId) return -1;
    return filtered.findIndex((row) => row.id === previewId);
  }, [filtered, previewId]);

  const previewRow = previewIndex >= 0 ? filtered[previewIndex] : null;

  useEffect(() => {
    if (previewId && previewIndex < 0) setPreviewId(null);
  }, [previewId, previewIndex]);

  const openPreviewAt = (index: number) => {
    const row = filtered[index];
    if (!row) return;
    setLightbox(null);
    setPreviewId(row.id);
  };

  const cyclePreview = (delta: number) => {
    if (previewIndex < 0 || filtered.length === 0) return;
    const next =
      filtered[(previewIndex + delta + filtered.length) % filtered.length];
    if (next) setPreviewId(next.id);
  };

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
      <p className="type-p-m text-[var(--muted)]">
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
            <p className="type-p-s px-3 py-4 text-[var(--muted)]">
              No dated posts yet.
            </p>
          )}
        </nav>

        <div className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)]">
          <table className="type-p-m w-full min-w-[68rem] table-fixed text-left">
            <thead className="bg-[var(--bg)] text-[var(--muted)]">
              <tr>
                <th className="type-h5 w-[6.5rem] whitespace-nowrap px-3 py-2.5 text-left">
                  Date &amp; time
                </th>
                <th className="type-h5 w-[4rem] px-2 py-2.5 text-left">
                  Media
                </th>
                <th className="type-h5 w-[7.5rem] px-3 py-2.5 text-left">
                  Caption
                </th>
                <th className="type-h5 w-[8.5rem] px-2 py-2.5 text-left">
                  Hashtags
                </th>
                <th className="type-h5 w-[3.75rem] px-2 py-2.5 text-left">
                  Impr
                </th>
                <th className="type-h5 w-[3.5rem] px-2 py-2.5 text-left">
                  Eng %
                </th>
                <th className="type-h5 w-[3.5rem] px-2 py-2.5 text-left">
                  Eng
                </th>
                <th className="type-h5 w-[3.25rem] px-2 py-2.5 text-left">
                  Likes
                </th>
                <th className="type-h5 w-[3.5rem] px-2 py-2.5 text-left">
                  Reposts
                </th>
                <th className="type-h5 w-[3.75rem] px-2 py-2.5 text-left">
                  Comments
                </th>
                <th className="type-h5 w-[3.25rem] px-2 py-2.5 text-left">
                  Saves
                </th>
                <th className="type-h5 w-[3.25rem] px-2 py-2.5 text-left">
                  Sends
                </th>
                <th className="type-h5 w-[4.25rem] px-2 py-2.5 text-left">
                  Followers
                </th>
                <th className="type-h5 w-[5rem] px-1.5 py-2.5 text-left">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, index) => {
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
                    <td className="whitespace-nowrap px-3 py-2.5 text-left">
                      {when ? (
                        <div>
                          <div>{when.date}</div>
                          <div className="type-p-s text-[var(--muted)]">
                            {when.time}
                          </div>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-left">
                      <MediaThumbButton
                        item={mediaItem}
                        onOpen={() => setLightbox(mediaItem)}
                      />
                    </td>
                    <td
                      className="truncate px-3 py-2.5 text-left"
                      title={row.title || row.content}
                    >
                      {truncateCaption(row.title || row.content) || "—"}
                    </td>
                    <td className="px-2 py-2.5 text-left">
                      {hashtags.length ? (
                        <div className="flex flex-wrap gap-1">
                          {hashtags.slice(0, 4).map((tag) => (
                            <HashtagTag
                              key={tag}
                              tag={tag}
                              onClick={(t) =>
                                setActiveHashtag(formatHashtagLabel(t))
                              }
                            />
                          ))}
                          {hashtags.length > 4 ? (
                            <span className="type-p-s text-[var(--muted)]">
                              +{hashtags.length - 4}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-[var(--muted)]">—</span>
                      )}
                    </td>
                    <td className="tabular-nums px-2 py-2.5 text-left">
                      {formatCompactNumber(row.impressions)}
                    </td>
                    <td className="tabular-nums px-2 py-2.5 text-left">
                      {engRate}
                    </td>
                    <td className="tabular-nums px-2 py-2.5 text-left">
                      {formatCompactNumber(row.engagements)}
                    </td>
                    <td className="tabular-nums px-2 py-2.5 text-left">
                      {formatCompactNumber(row.likes)}
                    </td>
                    <td className="tabular-nums px-2 py-2.5 text-left">
                      {formatCompactNumber(row.reposts)}
                    </td>
                    <td className="tabular-nums px-2 py-2.5 text-left">
                      {formatCompactNumber(row.comments)}
                    </td>
                    <td className="tabular-nums px-2 py-2.5 text-left">
                      {formatCompactNumber(row.saves)}
                    </td>
                    <td className="tabular-nums px-2 py-2.5 text-left">
                      {formatCompactNumber(row.sends)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-left">
                      {row.followersAtPublish == null ? (
                        "—"
                      ) : (
                        <div>
                          <div className="tabular-nums">
                            {formatCompactNumber(row.followersAtPublish)}
                          </div>
                          <FollowerDelta delta={followerDelta} />
                        </div>
                      )}
                    </td>
                    <td className="px-1.5 py-2.5 text-left">
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => openPreviewAt(index)}
                          className="inline-flex size-9 cursor-pointer items-center justify-center rounded-md text-[var(--accent)] transition-colors hover:bg-[var(--accent-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] active:scale-[0.98]"
                          aria-label={`Preview post: ${truncateCaption(row.title || row.content) || "untitled"}`}
                          title="Preview"
                        >
                          <Maximize2 size={14} strokeWidth={1.2} aria-hidden />
                        </button>
                        {row.linkedinPostUrl ? (
                          <a
                            href={row.linkedinPostUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex size-9 items-center justify-center rounded-md text-[var(--accent)] transition-colors hover:bg-[var(--accent-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                            aria-label="Open on LinkedIn"
                            title="Open on LinkedIn"
                          >
                            <ExternalLink size={14} strokeWidth={1.2} aria-hidden />
                          </a>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={14}
                    className="type-p-m px-4 py-10 text-center text-[var(--muted)]"
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
      {previewRow && previewIndex >= 0 ? (
        <PostPreviewModal
          post={toPreviewPost(previewRow)}
          stats={toPreviewStats(previewRow)}
          onClose={() => setPreviewId(null)}
          onPrev={
            filtered.length > 1 ? () => cyclePreview(-1) : undefined
          }
          onNext={
            filtered.length > 1 ? () => cyclePreview(1) : undefined
          }
          positionLabel={
            filtered.length > 1
              ? `${previewIndex + 1} / ${filtered.length}`
              : null
          }
          onHashtagClick={(tag) => {
            setPreviewId(null);
            setActiveHashtag(formatHashtagLabel(tag));
          }}
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
      <div className="type-p-s text-[var(--muted)]" title="No previous post">
        —
      </div>
    );
  }
  if (delta === 0) {
    return (
      <div className="type-p-s text-[var(--muted)]" title="No change">
        ±0
      </div>
    );
  }
  const up = delta > 0;
  return (
    <div
      className={`type-btn-s tabular-nums ${
        up ? "text-[var(--success)]" : "text-red-600"
      }`}
      title={`${up ? "Up" : "Down"} ${formatCompactNumber(Math.abs(delta))} since previous post`}
    >
      {up ? "+" : "−"}
      {formatCompactNumber(Math.abs(delta))}
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
      className={`type-p-m mb-1 flex h-10 w-full items-center justify-between gap-2 rounded-lg border pl-3 pr-3 text-left transition last:mb-0 ${
        active
          ? "type-btn-m border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
          : "type-label-l border-transparent text-[var(--ink)] hover:bg-[var(--bg)]"
      }`}
    >
      <span className="truncate">{label}</span>
      <span
        className={`type-p-s shrink-0 ${
          active ? "text-[var(--accent)]" : "text-[var(--muted)]"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
