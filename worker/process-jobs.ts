/**
 * Always-on automation worker.
 * Polls due jobs (12h repost, second comment, metrics) so you don't
 * manually run anything after scheduling in Composer.
 *
 * Started automatically by `npm run dev` / `npm run start:app`.
 */
import { canExecuteBrowserJobs, automationModeLabel } from "../src/lib/automation";
import { processDueJobs } from "../src/lib/jobs";

const intervalMs = Number(process.env.WORKER_POLL_MS ?? 60_000);
const once = process.argv.includes("--once");

async function tick() {
  const result = await processDueJobs(20);
  if (
    result.processed > 0 ||
    result.done.length > 0 ||
    result.failed.length > 0 ||
    result.deferred.length > 0
  ) {
    console.log(
      JSON.stringify(
        {
          at: new Date().toISOString(),
          mode: automationModeLabel(),
          browser: canExecuteBrowserJobs(),
          ...result,
        },
        null,
        0,
      ),
    );
  }
}

async function main() {
  console.log(
    `[linkedwin-worker] mode=${automationModeLabel()} browser=${canExecuteBrowserJobs()} poll=${intervalMs}ms`,
  );

  if (once) {
    const result = await processDueJobs(20);
    console.log(JSON.stringify(result, null, 2));
    if (result.failed.length > 0) process.exitCode = 1;
    return;
  }

  // Run immediately, then on an interval.
  for (;;) {
    try {
      await tick();
    } catch (err) {
      console.error("[linkedwin-worker] tick failed", err);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
