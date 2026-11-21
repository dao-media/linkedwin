/**
 * LinkedIn activity sync — the same command the GitHub Action runs on a schedule
 * (.github/workflows/linkedin-sync.yml).
 *
 *   npm run activity:sync -- --dry          # scrape + show what would change, no DB writes
 *   npm run activity:sync                   # apply
 *   npm run activity:sync -- --scrolls 40   # dig further back (first run / catch-up)
 * Add PLAYWRIGHT_HEADLESS=false to watch the browser.
 */
// Local runs read .env.local; CI passes secrets as real env vars (file absent).
try {
  process.loadEnvFile(".env.local");
} catch {
  /* no .env.local — fine in CI */
}

const dryRun = process.argv.includes("--dry");
const i = process.argv.indexOf("--scrolls");
const maxScrolls = i > 0 ? Number(process.argv[i + 1]) : undefined;

// Dynamic import so the DB client sees env loaded above
import("../worker/activity-sync")
  .then(({ runAndRecordActivitySync }) => runAndRecordActivitySync({ dryRun, maxScrolls }))
  .then((r) => {
    console.log(`Profile: ${r.vanity}  seen=${r.seen}  unchanged=${r.unchanged}`);
    console.log(`${dryRun ? "Would insert" : "Inserted"} ${r.inserted.length}:`);
    r.inserted.forEach((l) => console.log("  + " + l));
    console.log(`${dryRun ? "Would upgrade" : "Upgraded"} ${r.upgraded.length} (lossy caption / missing URL or media):`);
    r.upgraded.forEach((l) => console.log("  ~ " + l));
    if (r.metrics !== undefined) console.log(`Metrics snapshots: ${r.metrics}`);
  })
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
