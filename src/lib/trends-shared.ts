import { formatCompactNumber } from "@/lib/calendar-format";

/** Client-safe trends types and helpers (no Node/DB imports). */

export type TrendsSeriesPoint = {
  date: string;
  label: string;
  value: number;
};

export type TrendsPostSummary = {
  id: string;
  title: string;
  content: string;
  footer?: string | null;
  mediaType?: string | null;
  mediaUrl?: string | null;
  mediaTitle?: string | null;
  firstComment?: string | null;
  secondComment?: string | null;
  thirdComment?: string | null;
  topics?: string;
  publishedAt: string | null;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  sends: number;
  reposts: number;
  organicReposts: number;
  engagements: number;
  engagementRate: number;
};

export type TrendsHashtagRow = {
  tag: string;
  /** Average impressions per post using this hashtag. */
  avgImpressions: number;
  posts: number;
};

export type TrendsDashboard = {
  widgets: {
    followers: number | null;
    followersDeltaWeek: number | null;
    avgImpressionsPerWeek: number;
    topPostOfWeek: TrendsPostSummary | null;
  };
  charts: {
    followerGrowth: Record<string, TrendsSeriesPoint[]>;
    dailyImpressions: Record<string, TrendsSeriesPoint[]>;
    weeklyImpressions: Record<string, TrendsSeriesPoint[]>;
    engagement: Record<string, TrendsSeriesPoint[]>;
    organicReposts: Record<string, TrendsSeriesPoint[]>;
  };
  leaders: Record<
    string,
    {
      impressions: TrendsPostSummary[];
      engagement: TrendsPostSummary[];
      likes: TrendsPostSummary[];
      comments: TrendsPostSummary[];
      saves: TrendsPostSummary[];
      sends: TrendsPostSummary[];
      hashtags: TrendsHashtagRow[];
    }
  >;
  referencePosts: TrendsPostSummary[];
};

export function formatFollowersDelta(
  delta: number | null | undefined,
): string | null {
  if (delta == null || !Number.isFinite(delta)) return null;
  if (delta === 0) return "Flat this week";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${formatCompactNumber(delta)} this week`;
}
