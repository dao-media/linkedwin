"use client";

import { useMemo, useState } from "react";
import { Eye, Maximize2, TrendingUp, Users } from "lucide-react";
import { PeriodChips } from "@/components/PeriodChips";
import {
  PostPreviewModal,
  type PostPreviewData,
  type PostPreviewStats,
} from "@/components/PostPreviewModal";
import { TrendsChartCard } from "@/components/TrendsChartCard";
import { TrendsReferenceExport } from "@/components/TrendsReferenceExport";
import { formatCompactNumber, formatHashtagLabel, postHasHashtag } from "@/lib/calendar-format";
import type { TrendsDashboard, TrendsPostSummary } from "@/lib/trends-shared";
import { formatFollowersDelta } from "@/lib/trends-shared";
import {
  HashtagPostsModal,
  type HashtagPostSummary,
} from "@/components/HashtagPostsModal";
import { HashtagTag } from "@/components/HashtagTag";
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

type Dashboard = TrendsDashboard;

type LeadersTab =
  | "impressions"
  | "engagement"
  | "likes"
  | "comments"
  | "saves"
  | "sends"
  | "hashtags";

const TABS: { id: LeadersTab; label: string }[] = [
  { id: "impressions", label: "Impressions" },
  { id: "engagement", label: "Engagement" },
  { id: "likes", label: "Likes" },
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
    thirdComment: post.thirdComment,
    topics: post.topics,
    stats: {
      impressions: post.impressions,
      engagementRate: post.engagementRate,
      engagements: post.engagements,
      likes: post.likes,
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
    case "likes":
      return formatCompactNumber(post.likes);
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
  const [activeHashtag, setActiveHashtag] = useState<string | null>(null);

  const leaders = data.leaders[leadersPeriod as keyof typeof data.leaders];
  const postRows = useMemo(() => {
    if (!leaders || tab === "hashtags") return [];
    return leaders[tab];
  }, [leaders, tab]);

  const matchingHashtagPosts = useMemo((): HashtagPostSummary[] => {
    if (!activeHashtag) return [];
    return data.referencePosts
      .filter((p) =>
        postHasHashtag(p.content, p.topics ?? "[]", activeHashtag),
      )
      .map((p) => ({
        id: p.id,
        title: p.title,
        content: p.content,
        status: "published",
        topics: p.topics ?? "[]",
        scheduledFor: null,
        publishedAt: p.publishedAt,
        impressions: p.impressions,
      }));
  }, [activeHashtag, data.referencePosts]);

  function openHashtag(tag: string) {
    setActiveHashtag(formatHashtagLabel(tag));
  }

  const deltaLabel = formatFollowersDelta(data.widgets.followersDeltaWeek);
  const top = data.widgets.topPostOfWeek;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
          <div className="type-p-s flex items-center gap-2 text-[var(--muted)]">
            <Users className="size-3.5" strokeWidth={1.2} aria-hidden />
            Followers
          </div>
          <div className="type-stat mt-1">
            {formatCompactNumber(data.widgets.followers)}
          </div>
          {deltaLabel ? (
            <div className="type-btn-s mt-1 text-[var(--success)]">
              {deltaLabel}
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
          <div className="type-p-s flex items-center gap-2 text-[var(--muted)]">
            <Eye className="size-3.5" strokeWidth={1.2} aria-hidden />
            Average impressions
          </div>
          <div className="type-stat mt-1">
            {formatCompactNumber(data.widgets.avgImpressionsPerWeek)}
          </div>
          <div className="type-p-s mt-1 text-[var(--muted)]">
            Per week · trailing-month average
          </div>
        </div>

        <button
          type="button"
          disabled={!top}
          onClick={() => top && setPreview(toPreview(top))}
          className="rounded-xl border border-[var(--accent)] bg-[var(--surface)] p-5 text-left transition hover:bg-[var(--accent-soft)] disabled:cursor-default disabled:border-[var(--line)] disabled:hover:bg-[var(--surface)]"
        >
          <div className="type-p-s flex items-center gap-2 text-[var(--muted)]">
            <TrendingUp className="size-3.5" strokeWidth={1.2} aria-hidden />
            Top post of the week
          </div>
          <div className="type-h3 mt-1 line-clamp-2 text-[var(--ink)]">
            {top?.title ?? "No published posts this week"}
          </div>
          {top ? (
            <div className="type-btn-s mt-2 inline-flex items-center gap-1 text-[var(--accent)]">
              {formatCompactNumber(top.impressions)} impr · View preview
              <Maximize2 size={14} strokeWidth={1.2} className="shrink-0" aria-hidden />
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
        title="Average impressions"
        subtitle="Totals per week for the selected period"
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
            <h2 className="type-h5 text-[var(--ink)]">Leaders</h2>
            <p className="type-p-s mt-0.5 text-[var(--muted)]">
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
                    ? "type-btn-s rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-1.5 text-[var(--accent)]"
                    : "type-p-s rounded-full border border-transparent px-3 py-1.5 text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--ink)]"
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
              <li className="type-p-m py-6 text-[var(--muted)]">
                No hashtag data for this period.
              </li>
            )}
            {(leaders?.hashtags ?? []).map((row, i) => (
              <li
                key={row.tag}
                className="type-p-m flex items-center gap-3 py-2.5"
              >
                <span className="type-btn-s w-6 shrink-0 text-[var(--muted)]">
                  {i + 1}
                </span>
                <HashtagTag tag={row.tag} onClick={openHashtag} />
                <span className="type-p-s ml-auto shrink-0 text-[var(--muted)]">
                  {formatCompactNumber(row.avgImpressions)} avg impr ·{" "}
                  {row.posts} posts
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {postRows.length === 0 && (
              <li className="type-p-m py-6 text-[var(--muted)]">
                No posts for this period.
              </li>
            )}
            {postRows.map((post, i) => (
              <li
                key={post.id}
                className="type-p-m flex items-center gap-3 py-2.5"
              >
                <span className="type-btn-s w-6 shrink-0 text-[var(--muted)]">
                  {i + 1}
                </span>
                <span className="type-label-l min-w-0 flex-1 truncate text-[var(--ink)]">
                  {post.title}
                </span>
                <span className="type-p-s shrink-0 text-[var(--muted)]">
                  {metricForTab(tab, post)}
                </span>
                <button
                  type="button"
                  onClick={() => setPreview(toPreview(post))}
                  className="type-btn-s inline-flex shrink-0 items-center gap-1 text-[var(--accent)] hover:underline"
                >
                  <Maximize2 size={14} strokeWidth={1.2} className="shrink-0" aria-hidden />
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
          onHashtagClick={(tag) => {
            setPreview(null);
            openHashtag(tag);
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
