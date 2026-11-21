"use client";

import { useMemo, useState } from "react";
import { BookOpen, ChevronDown, Download, Search, X } from "lucide-react";
import { PeriodChips } from "@/components/PeriodChips";
import type { TrendsPostSummary } from "@/lib/trends-shared";
import {
  MAX_COMMENTS_STEPS,
  MAX_ENGAGEMENT_RATE_STEPS,
  MAX_REACTIONS_STEPS,
  MAX_REPOSTS_STEPS,
  MIN_COMMENTS_STEPS,
  MIN_ENGAGEMENT_RATE_STEPS,
  MIN_REACTIONS_STEPS,
  MIN_REPOSTS_STEPS,
  REFERENCE_COUNT_OPTIONS,
  REFERENCE_RANK_OPTIONS,
  buildReferenceFilename,
  buildReferenceMarkdown,
  downloadTextFile,
  filterReferencePosts,
  formatMaxCountLabel,
  formatMaxEngagementRateLabel,
  formatMinCountLabel,
  formatMinEngagementRateLabel,
  formatReferenceMetric,
  lastThresholdStep,
  type MaxComments,
  type MaxEngagementRate,
  type MaxReactions,
  type MaxReposts,
  type MinComments,
  type MinEngagementRate,
  type MinReactions,
  type MinReposts,
  type ReferenceCount,
  type ReferenceFilters,
  type ReferenceRankId,
} from "@/lib/trends-export";
import {
  LEADERS_PERIODS,
  periodsFor,
  type TrendsPeriodId,
} from "@/lib/trends-periods";

function ThresholdSlider<T extends number>({
  label,
  steps,
  value,
  onChange,
  formatValue,
}: {
  label: string;
  steps: readonly T[];
  value: T;
  onChange: (value: T) => void;
  formatValue: (value: T, isMaxStep: boolean) => string;
}) {
  const index = Math.max(0, steps.findIndex((step) => Object.is(step, value)));
  const isMax = index === steps.length - 1;
  const display = formatValue(value, isMax);

  return (
    <div className="min-w-0 space-y-1.5">
      <span className="type-section-m text-[var(--muted)]">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={steps.length - 1}
          step={1}
          value={index < 0 ? steps.length - 1 : index}
          aria-label={label}
          aria-valuetext={display}
          onChange={(e) => {
            const next = steps[Number(e.target.value)];
            if (next !== undefined) onChange(next);
          }}
          className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--line)] accent-[var(--accent)]"
        />
        <span className="type-btn-s inline-flex h-7 w-[4.75rem] shrink-0 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)] px-1.5 text-center tabular-nums text-[var(--ink)]">
          {display}
        </span>
      </div>
    </div>
  );
}

function ThresholdPairCard({
  title,
  summary,
  children,
}: {
  title: string;
  /** Compact range shown while collapsed. */
  summary: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <ChevronDown
          className={`size-3.5 shrink-0 text-[var(--muted)] transition-transform duration-[250ms] ease-[cubic-bezier(0.215,0.61,0.355,1)] ${
            open ? "rotate-0" : "-rotate-90"
          }`}
          strokeWidth={1.2}
          aria-hidden
        />
        <span className="type-label-s min-w-0 flex-1 text-[var(--ink)]">
          {title}
        </span>
        {!open ? (
          <span className="type-chip shrink-0 tabular-nums text-[var(--muted)]">
            {summary}
          </span>
        ) : null}
      </button>
      {open ? <div className="space-y-3 border-t border-[var(--line)] p-3">{children}</div> : null}
    </div>
  );
}

function ReferenceSelection({
  candidates,
  rankBy,
  filters,
}: {
  candidates: TrendsPostSummary[];
  rankBy: ReferenceRankId;
  filters: ReferenceFilters;
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
        <p className="type-p-s text-[var(--muted)]">
          {candidates.length} matched · {selectedPosts.length} selected
        </p>
        <div className="type-btn-s flex gap-3">
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
          <li className="type-p-m px-3 py-6 text-[var(--muted)]">
            No published posts match these filters.
          </li>
        )}
        {candidates.map((post, index) => {
          const checked = selectedIds.has(post.id);
          return (
            <li key={`${rankBy}-${post.id}`}>
              <label className="type-p-m flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-[var(--bg)]">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--accent)]"
                  checked={checked}
                  onChange={() => toggle(post.id)}
                />
                <span className="type-btn-s w-5 shrink-0 tabular-nums text-[var(--muted)]">
                  {index + 1}
                </span>
                <span className="type-label-l min-w-0 flex-1 truncate text-[var(--ink)]">
                  {post.title}
                </span>
                <span className="type-btn-s inline-flex shrink-0 items-center gap-1.5 tabular-nums text-[var(--muted)]">
                  {formatReferenceMetric(post, rankBy)}
                  {rankBy === "engagement" ? (
                    <span className="type-chip rounded border border-[var(--line)] bg-[var(--bg)] px-1.5 py-0.5 text-[var(--muted)]">
                      {post.engagementRate.toFixed(1)}%
                    </span>
                  ) : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="type-label-s min-w-0 truncate font-mono text-[var(--muted)]">
          {selectedPosts.length} posts · {filename}
        </p>
        <button
          type="button"
          disabled={selectedPosts.length === 0}
          onClick={exportMd}
          className="type-btn-l inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-40"
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
  const [keyword, setKeyword] = useState("");
  const [minComments, setMinComments] = useState<MinComments>(0);
  const [maxComments, setMaxComments] = useState<MaxComments>(() =>
    lastThresholdStep(MAX_COMMENTS_STEPS),
  );
  const [minReactions, setMinReactions] = useState<MinReactions>(0);
  const [maxReactions, setMaxReactions] = useState<MaxReactions>(() =>
    lastThresholdStep(MAX_REACTIONS_STEPS),
  );
  const [minEngagementRate, setMinEngagementRate] =
    useState<MinEngagementRate>(0);
  const [maxEngagementRate, setMaxEngagementRate] = useState<MaxEngagementRate>(
    () => lastThresholdStep(MAX_ENGAGEMENT_RATE_STEPS),
  );
  const [minReposts, setMinReposts] = useState<MinReposts>(0);
  const [maxReposts, setMaxReposts] = useState<MaxReposts>(() =>
    lastThresholdStep(MAX_REPOSTS_STEPS),
  );

  const filters = useMemo(
    () => ({
      period,
      rankBy,
      count,
      keyword,
      minComments,
      maxComments,
      minReactions,
      maxReactions,
      minEngagementRate,
      maxEngagementRate,
      minReposts,
      maxReposts,
    }),
    [
      period,
      rankBy,
      count,
      keyword,
      minComments,
      maxComments,
      minReactions,
      maxReactions,
      minEngagementRate,
      maxEngagementRate,
      minReposts,
      maxReposts,
    ],
  );

  const candidates = useMemo(
    () => filterReferencePosts(posts, filters),
    [posts, filters],
  );

  const membershipKey = useMemo(
    () =>
      candidates
        .map((c) => c.id)
        .slice()
        .sort()
        .join(","),
    [candidates],
  );

  const selectionKey = [
    period,
    count,
    keyword.trim().toLowerCase(),
    minComments,
    maxComments,
    minReactions,
    maxReactions,
    minEngagementRate,
    maxEngagementRate,
    minReposts,
    maxReposts,
    membershipKey,
  ].join("|");

  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
      <div className="mb-4">
        <h2 className="type-h5 flex items-center gap-2 text-[var(--ink)]">
          <BookOpen
            className="size-4 text-[var(--accent)]"
            strokeWidth={1.2}
            aria-hidden
          />
          Content reference
        </h2>
        <p className="type-p-s mt-1 max-w-2xl text-[var(--muted)]">
          Build a markdown packet of prior posts to spot patterns and
          opportunities — for you or an AI collaborator.
        </p>
      </div>

      <div className="space-y-3 border-b border-[var(--line)] pb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
          <span className="type-section-m w-44 shrink-0 pt-1 text-[var(--muted)]">
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
          <span className="type-section-m w-44 shrink-0 pt-1 text-[var(--muted)]">
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
          <span className="type-section-m w-44 shrink-0 pt-1 text-[var(--muted)]">
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

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ThresholdPairCard
            title="Comments"
            summary={`${formatMinCountLabel(minComments, minComments === lastThresholdStep(MIN_COMMENTS_STEPS))} – ${formatMaxCountLabel(maxComments)}`}
          >
            <ThresholdSlider
              label="Min"
              steps={MIN_COMMENTS_STEPS}
              value={minComments}
              onChange={(next) => {
                setMinComments(next);
                if (Number.isFinite(maxComments) && next > maxComments) {
                  setMaxComments(next);
                }
              }}
              formatValue={formatMinCountLabel}
            />
            <ThresholdSlider
              label="Max"
              steps={MAX_COMMENTS_STEPS}
              value={maxComments}
              onChange={(next) => {
                setMaxComments(next);
                if (Number.isFinite(next) && next < minComments) {
                  setMinComments(next as MinComments);
                }
              }}
              formatValue={formatMaxCountLabel}
            />
          </ThresholdPairCard>

          <ThresholdPairCard
            title="Reactions"
            summary={`${formatMinCountLabel(minReactions, minReactions === lastThresholdStep(MIN_REACTIONS_STEPS))} – ${formatMaxCountLabel(maxReactions)}`}
          >
            <ThresholdSlider
              label="Min"
              steps={MIN_REACTIONS_STEPS}
              value={minReactions}
              onChange={(next) => {
                setMinReactions(next);
                if (Number.isFinite(maxReactions) && next > maxReactions) {
                  setMaxReactions(next);
                }
              }}
              formatValue={formatMinCountLabel}
            />
            <ThresholdSlider
              label="Max"
              steps={MAX_REACTIONS_STEPS}
              value={maxReactions}
              onChange={(next) => {
                setMaxReactions(next);
                if (Number.isFinite(next) && next < minReactions) {
                  setMinReactions(next as MinReactions);
                }
              }}
              formatValue={formatMaxCountLabel}
            />
          </ThresholdPairCard>

          <ThresholdPairCard
            title="Engagement rate"
            summary={`${formatMinEngagementRateLabel(minEngagementRate, minEngagementRate === lastThresholdStep(MIN_ENGAGEMENT_RATE_STEPS))} – ${formatMaxEngagementRateLabel(maxEngagementRate)}`}
          >
            <ThresholdSlider
              label="Min"
              steps={MIN_ENGAGEMENT_RATE_STEPS}
              value={minEngagementRate}
              onChange={(next) => {
                setMinEngagementRate(next);
                if (
                  Number.isFinite(maxEngagementRate) &&
                  next > maxEngagementRate
                ) {
                  setMaxEngagementRate(next);
                }
              }}
              formatValue={formatMinEngagementRateLabel}
            />
            <ThresholdSlider
              label="Max"
              steps={MAX_ENGAGEMENT_RATE_STEPS}
              value={maxEngagementRate}
              onChange={(next) => {
                setMaxEngagementRate(next);
                if (Number.isFinite(next) && next < minEngagementRate) {
                  setMinEngagementRate(next as MinEngagementRate);
                }
              }}
              formatValue={formatMaxEngagementRateLabel}
            />
          </ThresholdPairCard>

          <ThresholdPairCard
            title="Reposts (excl. mine)"
            summary={`${formatMinCountLabel(minReposts, minReposts === lastThresholdStep(MIN_REPOSTS_STEPS))} – ${formatMaxCountLabel(maxReposts)}`}
          >
            <ThresholdSlider
              label="Min"
              steps={MIN_REPOSTS_STEPS}
              value={minReposts}
              onChange={(next) => {
                setMinReposts(next);
                if (Number.isFinite(maxReposts) && next > maxReposts) {
                  setMaxReposts(next);
                }
              }}
              formatValue={formatMinCountLabel}
            />
            <ThresholdSlider
              label="Max"
              steps={MAX_REPOSTS_STEPS}
              value={maxReposts}
              onChange={(next) => {
                setMaxReposts(next);
                if (Number.isFinite(next) && next < minReposts) {
                  setMinReposts(next as MinReposts);
                }
              }}
              formatValue={formatMaxCountLabel}
            />
          </ThresholdPairCard>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <span className="type-section-m w-44 shrink-0 text-[var(--muted)]">
            Keyword
          </span>
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--muted)]"
              strokeWidth={1.2}
              aria-hidden
            />
            <input
              type="search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Search caption, hashtags, comments…"
              aria-label="Filter reference posts by keyword"
              className="type-p-m w-full rounded-lg border border-[var(--line)] bg-white py-2 pl-9 pr-9 text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
            />
            {keyword ? (
              <button
                type="button"
                onClick={() => setKeyword("")}
                aria-label="Clear keyword"
                className="absolute right-2 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--ink)]"
              >
                <X className="size-3.5" strokeWidth={1.2} aria-hidden />
              </button>
            ) : null}
          </div>
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
