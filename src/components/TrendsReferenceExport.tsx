"use client";

import { useMemo, useState } from "react";
import { BookOpen, Download } from "lucide-react";
import { PeriodChips } from "@/components/PeriodChips";
import type { TrendsPostSummary } from "@/lib/trends";
import {
  REFERENCE_COUNT_OPTIONS,
  REFERENCE_RANK_OPTIONS,
  buildReferenceFilename,
  buildReferenceMarkdown,
  downloadTextFile,
  filterReferencePosts,
  formatReferenceMetric,
  type ReferenceCount,
  type ReferenceRankId,
} from "@/lib/trends-export";
import {
  LEADERS_PERIODS,
  periodsFor,
  type TrendsPeriodId,
} from "@/lib/trends-periods";

function ReferenceSelection({
  candidates,
  rankBy,
  filters,
}: {
  candidates: TrendsPostSummary[];
  rankBy: ReferenceRankId;
  filters: {
    period: TrendsPeriodId;
    rankBy: ReferenceRankId;
    count: ReferenceCount;
  };
}) {
  const [selectedIds, setSelectedIds] = useState(
    () => new Set(candidates.map((p) => p.id)),
  );

  const selectedPosts = useMemo(
    () => candidates.filter((p) => selectedIds.has(p.id)),
    [candidates, selectedIds],
  );

  const filename = buildReferenceFilename(filters, selectedPosts.length);

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exportMd() {
    if (selectedPosts.length === 0) return;
    const md = buildReferenceMarkdown(selectedPosts, filters);
    downloadTextFile(
      buildReferenceFilename(filters, selectedPosts.length),
      md,
    );
  }

  return (
    <>
      <div className="mb-2 mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-[var(--muted)]">
          {candidates.length} matched · {selectedPosts.length} selected
        </p>
        <div className="flex gap-3 text-xs font-semibold">
          <button
            type="button"
            className="text-[var(--accent)] hover:underline"
            onClick={() => setSelectedIds(new Set(candidates.map((p) => p.id)))}
          >
            Select all
          </button>
          <button
            type="button"
            className="text-[var(--muted)] hover:underline"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </button>
        </div>
      </div>

      <ul className="mb-4 max-h-72 divide-y divide-[var(--line)] overflow-y-auto rounded-lg border border-[var(--line)]">
        {candidates.length === 0 && (
          <li className="px-3 py-6 text-sm text-[var(--muted)]">
            No published posts match these filters.
          </li>
        )}
        {candidates.map((post) => {
          const checked = selectedIds.has(post.id);
          return (
            <li key={post.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-[var(--bg)]">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--accent)]"
                  checked={checked}
                  onChange={() => toggle(post.id)}
                />
                <span className="min-w-0 flex-1 truncate font-medium text-[var(--ink)]">
                  {post.title}
                </span>
                <span className="shrink-0 text-xs text-[var(--muted)]">
                  {formatReferenceMetric(post, rankBy)}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 truncate font-mono text-[11px] text-[var(--muted)]">
          {selectedPosts.length} posts · {filename}
        </p>
        <button
          type="button"
          disabled={selectedPosts.length === 0}
          onClick={exportMd}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download className="size-4" strokeWidth={1.2} aria-hidden />
          Export .md
        </button>
      </div>
    </>
  );
}

export function TrendsReferenceExport({
  posts,
}: {
  posts: TrendsPostSummary[];
}) {
  const [period, setPeriod] = useState<TrendsPeriodId>("month");
  const [rankBy, setRankBy] = useState<ReferenceRankId>("impressions");
  const [count, setCount] = useState<ReferenceCount>(10);

  const filters = useMemo(
    () => ({ period, rankBy, count }),
    [period, rankBy, count],
  );

  const candidates = useMemo(
    () => filterReferencePosts(posts, filters),
    [posts, filters],
  );

  const selectionKey = `${period}|${rankBy}|${count}|${candidates.map((c) => c.id).join(",")}`;

  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
          <BookOpen
            className="size-4 text-[var(--accent)]"
            strokeWidth={1.2}
            aria-hidden
          />
          Content reference
        </h2>
        <p className="mt-1 max-w-2xl text-xs text-[var(--muted)]">
          Build a markdown packet of prior posts to spot patterns and
          opportunities — for you or an AI collaborator.
        </p>
      </div>

      <div className="space-y-3 border-b border-[var(--line)] pb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
          <span className="w-20 shrink-0 pt-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Period
          </span>
          <PeriodChips
            options={periodsFor(LEADERS_PERIODS)}
            value={period}
            onChange={setPeriod}
            ariaLabel="Reference export period"
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
          <span className="w-20 shrink-0 pt-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Rank by
          </span>
          <PeriodChips
            options={REFERENCE_RANK_OPTIONS.map((o) => ({
              id: o.id,
              label: o.label,
            }))}
            value={rankBy}
            onChange={(id) => setRankBy(id as ReferenceRankId)}
            ariaLabel="Reference export rank"
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
          <span className="w-20 shrink-0 pt-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Count
          </span>
          <PeriodChips
            options={REFERENCE_COUNT_OPTIONS.map((n) => ({
              id: String(n),
              label: String(n),
            }))}
            value={String(count)}
            onChange={(id) => setCount(Number(id) as ReferenceCount)}
            ariaLabel="Reference export count"
          />
        </div>
      </div>

      <ReferenceSelection
        key={selectionKey}
        candidates={candidates}
        rankBy={rankBy}
        filters={filters}
      />
    </section>
  );
}
