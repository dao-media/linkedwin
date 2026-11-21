import { Suspense } from "react";
import {
  CalendarClock,
  Eye,
  LineChart,
  ListChecks,
  Percent,
  Tags,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DateRangeSelect } from "@/components/DateRangeSelect";
import { OverviewTopHashtags } from "@/components/OverviewTopHashtags";
import { SetupChecklist } from "@/components/SetupChecklist";
import { getOverviewStats } from "@/lib/analytics";
import {
  formatCalendarDateChip,
  formatCompactNumber,
} from "@/lib/calendar-format";
import type { DateRangeId } from "@/lib/voice";
import { DATE_RANGES } from "@/lib/voice";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const sp = await searchParams;
  const range =
    (DATE_RANGES.find((r) => r.id === sp.range)?.id as DateRangeId) ?? "30d";
  const stats = await getOverviewStats(range);

  const cards = [
    {
      label: "Impressions",
      value: formatCompactNumber(stats.impressions),
      icon: Eye,
    },
    {
      label: "Engagement rate",
      value: `${stats.engagementRate.toFixed(1)}%`,
      icon: Percent,
    },
    {
      label: "Posts published",
      value: formatCompactNumber(stats.postsPublished),
      icon: ListChecks,
    },
    {
      label: "Planned",
      value: formatCompactNumber(stats.scheduledCount),
      icon: CalendarClock,
    },
  ] as const;

  return (
    <AppShell
      active="/"
      title="Overview"
      actions={
        <Suspense fallback={null}>
          <DateRangeSelect value={range} />
        </Suspense>
      }
    >
      <SetupChecklist />
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5"
          >
            <div className="flex items-center gap-2 type-p-s text-[var(--muted)]">
              <Icon className="size-3.5" strokeWidth={1.2} aria-hidden />
              {label}
            </div>
            <div className="mt-1 type-stat">{value}</div>
          </div>
        ))}
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 lg:col-span-2">
          <h2 className="mb-3 flex items-center gap-2 type-h5">
            <LineChart
              className="size-4 text-[var(--accent)]"
              strokeWidth={1.2}
              aria-hidden
            />
            Impressions trend
          </h2>
          {stats.impressionTrend.length === 0 ? (
            <p className="flex h-44 items-center justify-center rounded-lg bg-[var(--accent-soft)] type-p-m text-[var(--muted)]">
              No impression data yet
            </p>
          ) : (
            <div className="flex h-44 items-end gap-1 rounded-lg bg-[var(--accent-soft)] p-4 sm:gap-2">
              {(() => {
                const max = Math.max(
                  ...stats.impressionTrend.map((d) => d.impressions),
                  1,
                );
                return stats.impressionTrend.map((d) => {
                  const pct = Math.max(4, (d.impressions / max) * 100);
                  return (
                    <div
                      key={d.date}
                      className="min-w-0 flex-1 rounded-t bg-[var(--accent)]/70"
                      style={{ height: `${pct}%` }}
                      title={`${d.date}: ${formatCompactNumber(d.impressions)}`}
                    />
                  );
                });
              })()}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
          <h2 className="mb-3 flex items-center gap-2 type-h5">
            <Tags
              className="size-4 text-[var(--accent)]"
              strokeWidth={1.2}
              aria-hidden
            />
            Top hashtags
          </h2>
          <OverviewTopHashtags
            rows={stats.topHashtags}
            posts={stats.hashtagPosts}
          />
        </div>
      </div>

      <section>
        <h2 className="mb-3 flex items-center gap-2 type-h5">
          <ListChecks
            className="size-4 text-[var(--accent)]"
            strokeWidth={1.2}
            aria-hidden
          />
          Recent posts
        </h2>
        <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
          <table className="w-full table-fixed text-left type-p-m">
            <colgroup>
              <col />
              <col className="w-[8.5rem]" />
              <col className="w-[8.5rem]" />
            </colgroup>
            <thead className="bg-[var(--bg)] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 text-left type-h5 text-[var(--muted)]">Post</th>
                <th className="px-4 py-3 text-left type-h5 text-[var(--muted)]">
                  Impressions
                </th>
                <th className="px-4 py-3 text-left type-h5 text-[var(--muted)]">
                  Engagement
                </th>
              </tr>
            </thead>
            <tbody>
              {stats.recent.map((p) => {
                const published = p.publishedAt
                  ? new Date(p.publishedAt)
                  : null;
                const chip =
                  published && !Number.isNaN(published.getTime())
                    ? formatCalendarDateChip(published)
                    : null;
                return (
                  <tr key={p.id} className="border-t border-[var(--line)]">
                    <td className="px-4 py-3 align-middle text-left">
                      <div className="flex min-w-0 items-center gap-2.5">
                        {chip && (
                          <span className="type-chip inline-flex h-6 shrink-0 items-center rounded-md border border-[var(--line)] bg-[var(--bg)] px-2 text-[var(--muted)]">
                            {chip}
                          </span>
                        )}
                        <span
                          className="type-label-l min-w-0 truncate leading-none text-[var(--ink)]"
                          title={p.title}
                        >
                          {p.title}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle text-left text-[var(--muted)]">
                      {formatCompactNumber(p.impressions)}
                    </td>
                    <td className="px-4 py-3 align-middle text-left text-[var(--muted)]">
                      {p.engagement}
                    </td>
                  </tr>
                );
              })}
              {stats.recent.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-10 text-center text-[var(--muted)]"
                  >
                    No published posts in this range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
