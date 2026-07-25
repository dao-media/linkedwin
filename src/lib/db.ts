import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

const dataDir = path.join(process.cwd(), "data");
const dbPath = process.env.SQLITE_PATH ?? path.join(dataDir, "linkedwin.db");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const client = createClient({
  url: `file:${dbPath}`,
});

export const db = drizzle(client, { schema });

let migrated = false;

export async function ensureSchema() {
  if (migrated) return;
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      title TEXT,
      content TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      scheduled_for TEXT,
      published_at TEXT,
      timezone TEXT NOT NULL DEFAULT 'America/New_York',
      media_type TEXT,
      media_url TEXT,
      media_title TEXT,
      first_comment TEXT,
      second_comment TEXT,
      repost_after_hours INTEGER DEFAULT 12,
      repost_enabled INTEGER DEFAULT 1,
      zernio_post_id TEXT,
      linkedin_post_url TEXT,
      topics TEXT NOT NULL DEFAULT '[]',
      followers_at_publish INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS metrics_snapshots (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES posts(id),
      captured_at TEXT NOT NULL DEFAULT (datetime('now')),
      impressions INTEGER DEFAULT 0,
      likes INTEGER DEFAULT 0,
      comments INTEGER DEFAULT 0,
      shares INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      saves INTEGER DEFAULT 0,
      sends INTEGER DEFAULT 0,
      reposts INTEGER DEFAULT 0,
      engagement_rate REAL DEFAULT 0,
      raw_json TEXT
    );

    CREATE TABLE IF NOT EXISTS automation_jobs (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES posts(id),
      type TEXT NOT NULL,
      run_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ideas (
      id TEXT PRIMARY KEY,
      body TEXT NOT NULL,
      topic TEXT,
      status TEXT NOT NULL DEFAULT 'backlog',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS watch_accounts (
      id TEXT PRIMARY KEY,
      handle TEXT NOT NULL UNIQUE,
      display_name TEXT,
      niche TEXT,
      linkedin_url TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS radar_posts (
      id TEXT PRIMARY KEY,
      watch_account_id TEXT REFERENCES watch_accounts(id),
      author_handle TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT,
      engagement_score INTEGER DEFAULT 0,
      niche TEXT,
      captured_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS engage_recs (
      id TEXT PRIMARY KEY,
      handle TEXT NOT NULL,
      post_url TEXT,
      reason TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS follower_snapshots (
      id TEXT PRIMARY KEY,
      captured_at TEXT NOT NULL DEFAULT (datetime('now')),
      followers INTEGER NOT NULL,
      source TEXT NOT NULL DEFAULT 'settings'
    );
  `);

  // Additive columns for existing databases (CREATE IF NOT EXISTS won't alter).
  const alters = [
    "ALTER TABLE posts ADD COLUMN followers_at_publish INTEGER",
    "ALTER TABLE metrics_snapshots ADD COLUMN saves INTEGER DEFAULT 0",
    "ALTER TABLE metrics_snapshots ADD COLUMN sends INTEGER DEFAULT 0",
    "ALTER TABLE metrics_snapshots ADD COLUMN reposts INTEGER DEFAULT 0",
  ];
  for (const sql of alters) {
    try {
      await client.execute(sql);
    } catch {
      // column already exists
    }
  }

  migrated = true;
}
