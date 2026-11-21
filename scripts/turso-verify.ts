import "./_env";
import { createClient } from "@libsql/client";
import { ensureSchema } from "../src/lib/db";

async function main() {
  await ensureSchema();
  const url = process.env.LIBSQL_URL;
  const authToken = process.env.LIBSQL_AUTH_TOKEN;
  if (!url || !authToken) {
    throw new Error("LIBSQL_URL and LIBSQL_AUTH_TOKEN required");
  }
  const client = createClient({ url, authToken });
  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
  );
  console.log("Tables:", tables.rows.map((r) => r.name).join(", "));
  for (const t of [
    "posts",
    "automation_jobs",
    "settings",
    "daily_metrics",
    "metrics_snapshots",
  ]) {
    const r = await client.execute(`SELECT count(*) as c FROM ${t}`);
    console.log(t, r.rows[0].c);
  }
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
