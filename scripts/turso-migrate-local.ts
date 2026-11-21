/**
 * Copy all tables from local data/linkedwin.db into the remote libSQL DB
 * configured by LIBSQL_URL + LIBSQL_AUTH_TOKEN.
 */
import "./_env";
import { createClient } from "@libsql/client";
import path from "node:path";
import { ensureSchema } from "../src/lib/db";

const TABLES = [
  "posts",
  "metrics_snapshots",
  "automation_jobs",
  "topics",
  "ideas",
  "watch_accounts",
  "radar_posts",
  "engage_recs",
  "settings",
  "follower_snapshots",
  "daily_metrics",
] as const;

async function main() {
  const url = process.env.LIBSQL_URL?.trim();
  const authToken = process.env.LIBSQL_AUTH_TOKEN?.trim();
  if (!url || !authToken) {
    throw new Error("LIBSQL_URL and LIBSQL_AUTH_TOKEN are required");
  }

  const localPath =
    process.env.SQLITE_PATH ??
    path.join(process.cwd(), "data", "linkedwin.db");

  await ensureSchema();

  const local = createClient({ url: `file:${localPath}` });
  const remote = createClient({ url, authToken });

  for (const table of TABLES) {
    const existing = await remote.execute(`SELECT count(*) as c FROM ${table}`);
    const remoteCount = Number(existing.rows[0]?.c ?? 0);
    if (remoteCount > 0) {
      console.log(`skip ${table} (already has ${remoteCount} rows)`);
      continue;
    }

    const rows = await local.execute(`SELECT * FROM ${table}`);
    if (rows.rows.length === 0) {
      console.log(`${table}: 0 rows`);
      continue;
    }

    const cols = rows.columns;
    const placeholders = cols.map(() => "?").join(", ");
    const colList = cols.join(", ");
    let inserted = 0;
    for (const row of rows.rows) {
      const values = cols.map((c) => row[c] ?? null);
      await remote.execute({
        sql: `INSERT OR REPLACE INTO ${table} (${colList}) VALUES (${placeholders})`,
        args: values,
      });
      inserted += 1;
    }
    console.log(`${table}: inserted ${inserted}`);
  }

  await local.close();
  await remote.close();
  console.log("Migration complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
