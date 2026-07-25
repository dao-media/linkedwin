"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatCompactNumber,
  formatLibraryDateTime,
  formatMonthLabel,
  mediaLabel,
  postMonthKey,
  truncateCaption,
} from "@/lib/calendar-format";

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

  useEffect(() => {
    if (!highlightId || !highlightRef.current) return;
    highlightRef.current.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [highlightId, month, filtered]);

  useEffect(() => {
    if (!highlightId) return;
    const hit = rows.find((r) => r.id === highlightId);
    if (!hit) return;
    const key = postMonthKey(hit);
    if (key) setMonth(key);
  }, [highlightId, rows]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted)]">
        Browse by month or view all posts
        {highlightId && highlightTag ? (
          <>
            {" "}
            · Showing post from{" "}
            <span className="font-medium text-[var(--accent)]">
              {highlightTag}
            </span>
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
          <table className="w-full min-w-[68rem] text-left text-sm">
            <thead className="bg-[var(--bg)] text-[var(--muted)]">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">
                  Date &amp; time
                </th>
                <th className="w-[8.75rem] max-w-[8.75rem] px-4 py-3 text-left font-semibold">
                  Post caption
                </th>
                <th className="px-4 py-3 text-left font-semibold">Media</th>
                <th className="px-4 py-3 text-left font-semibold">
                  Impressions
                </th>
                <th className="px-4 py-3 text-left font-semibold">Eng. rate</th>
                <th className="px-4 py-3 text-left font-semibold">
                  Engagements
                </th>
                <th className="px-4 py-3 text-left font-semibold">Reposts</th>
                <th className="px-4 py-3 text-left font-semibold">Comments</th>
                <th className="px-4 py-3 text-left font-semibold">Saves</th>
                <th className="px-4 py-3 text-left font-semibold">Sends</th>
                <th className="px-4 py-3 text-left font-semibold">Followers</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const highlighted = highlightId === row.id;
                const when = formatLibraryDateTime(
                  row.publishedAt || row.scheduledFor || row.createdAt,
                );
                const media = mediaLabel(row.mediaType, row.mediaUrl);
                const engRate =
                  row.engRate != null ? `${row.engRate.toFixed(1)}%` : "—";
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
                    <td
                      className="w-[8.75rem] max-w-[8.75rem] truncate px-4 py-3 text-left"
                      title={row.title || row.content}
                    >
                      {truncateCaption(row.title || row.content) || "—"}
                    </td>
                    <td className="px-4 py-3 text-left text-[var(--muted)]">
                      {media}
                    </td>
                    <td className="px-4 py-3 text-left">
                      {formatCompactNumber(row.impressions)}
                    </td>
                    <td className="px-4 py-3 text-left">{engRate}</td>
                    <td className="px-4 py-3 text-left">
                      {formatCompactNumber(row.engagements)}
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
                    <td className="px-4 py-3 text-left">
                      {formatCompactNumber(row.followersAtPublish)}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={11}
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
