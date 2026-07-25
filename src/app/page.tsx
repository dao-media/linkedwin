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
import { getOverviewStats } from "@/lib/analytics";
import type { DateRangeId } from "@/lib/voice";
import { DATE_RANGES } from "@/lib/voice";

function formatNum(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(Math.round(n));
}

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
      value: formatNum(stats.impressions),
      icon: Eye,
    },
    {
      label: "Engagement rate",
      value: `${stats.engagementRate.toFixed(1)}%`,
      icon: Percent,
    },
    {
      label: "Posts published",
      value: String(stats.postsPublished),
      icon: ListChecks,
    },
    {
      label: "Queued",
      value: String(stats.scheduledCount),
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
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5"
          >
            <div className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
              <Icon className="size-3.5" strokeWidth={1.2} aria-hidden />
              {label}
            </div>
            <div className="mt-1 text-[28px] font-bold">{value}</div>
          </div>
        ))}
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 lg:col-span-2">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <LineChart
              className="size-4 text-[var(--accent)]"
              strokeWidth={1.2}
              aria-hidden
            />
            Impressions trend
          </h2>
          <div className="flex h-44 items-end gap-2 rounded-lg bg-[var(--accent-soft)] p-4">
            {[40, 55, 35, 70, 60, 85, 75, 90, 65, 80].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-[var(--accent)]/70"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Tags
              className="size-4 text-[var(--accent)]"
              strokeWidth={1.2}
              aria-hidden
            />
            Top topics
          </h2>
          <ul className="space-y-2 text-sm">
            {stats.topTopics.length === 0 && (
              <li className="text-[var(--muted)]">No topic data yet</li>
            )}
            {stats.topTopics.map((t) => (
              <li key={t.name}>
                {t.name} — {formatNum(t.impressions)} · {t.posts} posts
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <ListChecks
            className="size-4 text-[var(--accent)]"
            strokeWidth={1.2}
            aria-hidden
          />
          Recent posts
        </h2>
        <div className="space-y-2 text-sm text-[var(--muted)]">
          {stats.recent.length === 0 && <p>No published posts in this range.</p>}
          {stats.recent.map((p) => (
            <div
              key={p.id}
              className="flex justify-between gap-4 border-b border-[var(--line)] py-2 last:border-0"
            >
              <span className="truncate text-[var(--ink)]">{p.title}</span>
              <span className="shrink-0">
                {formatNum(p.impressions)} · {p.engagement} eng
              </span>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
