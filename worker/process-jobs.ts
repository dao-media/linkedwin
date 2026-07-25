/**
 * Fly.io worker entry — poll due automation jobs.
 * Usage: npx tsx worker/process-jobs.ts
 */
import { processDueJobs } from "../src/lib/jobs";

async function main() {
  const result = await processDueJobs(20);
  console.log(JSON.stringify(result, null, 2));
  if (result.failed.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
