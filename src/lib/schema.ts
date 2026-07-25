import { sql } from "drizzle-orm";
import {
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const posts = sqliteTable("posts", {
  id: text("id").primaryKey(),
  title: text("title"),
  content: text("content").notNull().default(""),
  status: text("status").notNull().default("draft"), // draft | scheduled | published | failed
  scheduledFor: text("scheduled_for"),
  publishedAt: text("published_at"),
  timezone: text("timezone").notNull().default("America/New_York"),
  mediaType: text("media_type"), // image | video | document | null
  mediaUrl: text("media_url"),
  mediaTitle: text("media_title"),
  firstComment: text("first_comment"),
  secondComment: text("second_comment"),
  repostAfterHours: integer("repost_after_hours").default(12),
  repostEnabled: integer("repost_enabled", { mode: "boolean" }).default(true),
  zernioPostId: text("zernio_post_id"),
  linkedinPostUrl: text("linkedin_post_url"),
  topics: text("topics").notNull().default("[]"), // JSON string[]
  /** Follower count snapshot at publish time (for spike analysis). */
  followersAtPublish: integer("followers_at_publish"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const metricsSnapshots = sqliteTable("metrics_snapshots", {
  id: text("id").primaryKey(),
  postId: text("post_id")
    .notNull()
    .references(() => posts.id),
  capturedAt: text("captured_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  impressions: integer("impressions").default(0),
  likes: integer("likes").default(0),
  comments: integer("comments").default(0),
  shares: integer("shares").default(0),
  clicks: integer("clicks").default(0),
  saves: integer("saves").default(0),
  sends: integer("sends").default(0),
  reposts: integer("reposts").default(0),
  engagementRate: real("engagement_rate").default(0),
  rawJson: text("raw_json"),
});

export const automationJobs = sqliteTable("automation_jobs", {
  id: text("id").primaryKey(),
  postId: text("post_id")
    .notNull()
    .references(() => posts.id),
  type: text("type").notNull(), // first_comment | second_comment | repost | metrics_sync
  runAt: text("run_at").notNull(),
  status: text("status").notNull().default("pending"), // pending | running | done | failed
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  completedAt: text("completed_at"),
});

export const topics = sqliteTable("topics", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const ideas = sqliteTable("ideas", {
  id: text("id").primaryKey(),
  body: text("body").notNull(),
  topic: text("topic"),
  status: text("status").notNull().default("backlog"), // backlog | queued | used
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const watchAccounts = sqliteTable("watch_accounts", {
  id: text("id").primaryKey(),
  handle: text("handle").notNull().unique(),
  displayName: text("display_name"),
  niche: text("niche"),
  linkedinUrl: text("linkedin_url"),
  notes: text("notes"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const radarPosts = sqliteTable("radar_posts", {
  id: text("id").primaryKey(),
  watchAccountId: text("watch_account_id").references(() => watchAccounts.id),
  authorHandle: text("author_handle").notNull(),
  title: text("title").notNull(),
  url: text("url"),
  engagementScore: integer("engagement_score").default(0),
  niche: text("niche"),
  capturedAt: text("captured_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const engageRecs = sqliteTable("engage_recs", {
  id: text("id").primaryKey(),
  handle: text("handle").notNull(),
  postUrl: text("post_url"),
  reason: text("reason").notNull(),
  score: integer("score").notNull().default(0),
  status: text("status").notNull().default("open"), // open | done | dismissed
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

/** Manual / publish-time follower count history for growth charts. */
export const followerSnapshots = sqliteTable("follower_snapshots", {
  id: text("id").primaryKey(),
  capturedAt: text("captured_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  followers: integer("followers").notNull(),
  source: text("source").notNull().default("settings"), // settings | publish
});
