"use client";

import { useMemo, useState } from "react";
import { Expand, Eye, Hash, TrendingUp, Users } from "lucide-react";
import { PeriodChips } from "@/components/PeriodChips";
import {
  PostPreviewModal,
  type PostPreviewData,
  type PostPreviewStats,
} from "@/components/PostPreviewModal";
import { TrendsChartCard } from "@/components/TrendsChartCard";
import { TrendsReferenceExport } from "@/components/TrendsReferenceExport";
import { formatCompactNumber } from "@/lib/calendar-format";
import type { getTrendsDashboard, TrendsPostSummary } from "@/lib/trends";
import { formatFollowersDelta } from "@/lib/trends";
import {
  DAILY_IMPRESSIONS_PERIODS,
  ENGAGEMENT_PERIODS,
  FOLLOWER_GROWTH_PERIODS,
  LEADERS_PERIODS,
  ORGANIC_REPOSTS_PERIODS,
  WEEKLY_IMPRESSIONS_PERIODS,
  periodsFor,
  type TrendsPeriodId,
} from "@/lib/trends-periods";

type Dashboard = Awaited<ReturnType<typeof getTrendsDashboard>>;

type LeadersTab =
  | "impressions"
  | "engagement"
  | "comments"
  | "saves"
  | "sends"
  | "hashtags";

const TABS: { id: LeadersTab; label: string }[] = [
  { id: "impressions", label: "Impressions" },
  { id: "engagement", label: "Engagement" },
  { id: "comments", label: "Comments" },
  { id: "saves", label: "Saves" },
  { id: "sends", label: "Sends" },
  { id: "hashtags", label: "Top hashtags" },
];

function toPreview(
  post: TrendsPostSummary,
): PostPreviewData & { stats: PostPreviewStats } {
  return {
    id: post.id,
    title: post.title,
    content: post.content,
    mediaType: post.mediaType,
    mediaUrl: post.mediaUrl,
    mediaTitle: post.mediaTitle,
    firstComment: post.firstComment,
    secondComment: post.secondComment,
    topics: post.topics,
    stats: {
      impressions: post.impressions,
      engagementRate: post.engagementRate,
      engagements: post.engagements,
      comments: post.comments,
      saves: post.saves,
      sends: post.sends,
      reposts: post.organicReposts,
    },
  };
}

function metricForTab(tab: LeadersTab, post: TrendsPostSummary): string {
  switch (tab) {
    case "impressions":
      return formatCompactNumber(post.impressions);
    case "engagement":
      return `${post.engagementRate.toFixed(1)}% · ${formatCompactNumber(post.engagements)}`;
    case "comments":
      return formatCompactNumber(post.comments);
    case "saves":
      return formatCompactNumber(post.saves);
    case "sends":
      return formatCompactNumber(post.sends);
    default:
      return "";
  }
}

export function TrendsView({ data }: { data: Dashboard }) {
  const [followerPeriod, setFollowerPeriod] =
    useState<TrendsPeriodId>("month");
  const [dailyPeriod, setDailyPeriod] = useState<TrendsPeriodId>("week");
  const [weeklyImprPeriod, setWeeklyImprPeriod] =
    useState<TrendsPeriodId>("quarter");
  const [engPeriod, setEngPeriod] = useState<TrendsPeriodId>("month");
  const [repostPeriod, setRepostPeriod] = useState<TrendsPeriodId>("quarter");
  const [leadersPeriod, setLeadersPeriod] = useState<TrendsPeriodId>("month");
  const [tab, setTab] = useState<LeadersTab>("impressions");
  const [preview, setPreview] = useState<
    (PostPreviewData & { stats: PostPreviewStats }) | null
  >(null);

  const leaders = data.leaders[leadersPeriod as keyof typeof data.leaders];
  const postRows = useMemo(() => {
    if (!leaders || tab === "hashtags") return [];
    return leaders[tab];
  }, [leaders, tab]);

  const deltaLabel = formatFollowersDelta(data.widgets.followersDeltaWeek);
  const top = data.widgets.topPostOfWeek;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
          <div className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
            <Users className="size-3.5" strokeWidth={1.2} aria-hidden />
            Followers
          </div>
          <div className="mt-1 text-[28px] font-bold">
            {data.widgets.followers != null
              ? data.widgets.followers.toLocaleString()
              : "—"}
          </div>
          {deltaLabel ? (
            <div className="mt-1 text-xs font-semibold text-[var(--success)]">
              {deltaLabel}
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
          <div className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
            <Eye className="size-3.5" strokeWidth={1.2} aria-hidden />
            Avg impressions / week
          </div>
          <div className="mt-1 text-[28px] font-bold">
            {formatCompactNumber(data.widgets.avgImpressionsPerWeek)}
          </div>
          <div className="mt-1 text-xs text-[var(--muted)]">
            Trailing month average
          </div>
        </div>

        <button
          type="button"
          disabled={!top}
          onClick={() => top && setPreview(toPreview(top))}
          className="rounded-xl border border-[var(--accent)] bg-[var(--surface)] p-5 text-left transition hover:bg-[var(--accent-soft)] disabled:cursor-default disabled:border-[var(--line)] disabled:hover:bg-[var(--surface)]"
        >
          <div className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
            <TrendingUp className="size-3.5" strokeWidth={1.2} aria-hidden />
            Top post of the week
          </div>
          <div className="mt-1 line-clamp-2 text-base font-semibold text-[var(--ink)]">
            {top?.title ?? "No published posts this week"}
          </div>
          {top ? (
            <div className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)]">
              {formatCompactNumber(top.impressions)} impr · View preview
              <Expand className="size-3.5 shrink-0" strokeWidth={1.2} aria-hidden />
            </div>
          ) : null}
        </button>
      </div>

      <TrendsChartCard
        title="Follower growth"
        periods={periodsFor(FOLLOWER_GROWTH_PERIODS)}
        period={followerPeriod}
        onPeriodChange={setFollowerPeriod}
        series={data.charts.followerGrowth[followerPeriod as keyof typeof data.charts.followerGrowth] ?? []}
      />

      <TrendsChartCard
        title="Daily impressions"
        periods={periodsFor(DAILY_IMPRESSIONS_PERIODS)}
        period={dailyPeriod}
        onPeriodChange={setDailyPeriod}
        series={data.charts.dailyImpressions[dailyPeriod as keyof typeof data.charts.dailyImpressions] ?? []}
      />

      <TrendsChartCard
        title="Average weekly impressions"
        periods={periodsFor(WEEKLY_IMPRESSIONS_PERIODS)}
        period={weeklyImprPeriod}
        onPeriodChange={setWeeklyImprPeriod}
        series={data.charts.weeklyImpressions[weeklyImprPeriod as keyof typeof data.charts.weeklyImpressions] ?? []}
      />

      <TrendsChartCard
        title="Average engagement"
        periods={periodsFor(ENGAGEMENT_PERIODS)}
        period={engPeriod}
        onPeriodChange={setEngPeriod}
        series={data.charts.engagement[engPeriod as keyof typeof data.charts.engagement] ?? []}
        formatValue={(n) => `${n.toFixed(1)}%`}
        valueSuffix="%"
      />

      <TrendsChartCard
        title="Average weekly organic reposts"
        subtitle="Excludes your own reposts & associated pages"
        periods={periodsFor(ORGANIC_REPOSTS_PERIODS)}
        period={repostPeriod}
        onPeriodChange={setRepostPeriod}
        series={data.charts.organicReposts[repostPeriod as keyof typeof data.charts.organicReposts] ?? []}
      />

      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[var(--ink)]">Leaders</h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              Period applies to every tab
            </p>
          </div>
          <PeriodChips
            options={periodsFor(LEADERS_PERIODS)}
            value={leadersPeriod}
            onChange={setLeadersPeriod}
            ariaLabel="Leaders time period"
          />
        </div>

        <div
          className="mb-4 flex flex-wrap gap-1.5 border-b border-[var(--line)] pb-3"
          role="tablist"
          aria-label="Leaders metrics"
        >
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={
                  active
                    ? "rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)]"
                    : "rounded-full border border-transparent px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--ink)]"
                }
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "hashtags" ? (
          <ul className="divide-y divide-[var(--line)]">
            {(leaders?.hashtags ?? []).length === 0 && (
              <li className="py-6 text-sm text-[var(--muted)]">
                No hashtag data for this period.
              </li>
            )}
            {(leaders?.hashtags ?? []).map((row, i) => (
              <li
                key={row.tag}
                className="flex items-center gap-3 py-2.5 text-sm"
              >
                <span className="w-6 shrink-0 text-xs font-semibold text-[var(--muted)]">
                  {i + 1}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--accent)]">
                  <Hash className="size-3" strokeWidth={1.5} aria-hidden />
                  {row.tag.replace(/^#/, "")}
                </span>
                <span className="ml-auto shrink-0 text-xs text-[var(--muted)]">
                  {formatCompactNumber(row.impressions)} impr · {row.posts} posts
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {postRows.length === 0 && (
              <li className="py-6 text-sm text-[var(--muted)]">
                No posts for this period.
              </li>
            )}
            {postRows.map((post, i) => (
              <li
                key={post.id}
                className="flex items-center gap-3 py-2.5 text-sm"
              >
                <span className="w-6 shrink-0 text-xs font-semibold text-[var(--muted)]">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-[var(--ink)]">
                  {post.title}
                </span>
                <span className="shrink-0 text-xs text-[var(--muted)]">
                  {metricForTab(tab, post)}
                </span>
                <button
                  type="button"
                  onClick={() => setPreview(toPreview(post))}
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline"
                >
                  <Expand className="size-3.5 shrink-0" strokeWidth={1.2} aria-hidden />
                  Preview
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <TrendsReferenceExport posts={data.referencePosts} />

      {preview ? (
        <PostPreviewModal
          post={preview}
          stats={preview.stats}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </div>
  );
}
