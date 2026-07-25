/**
 * When browser automation can actually run.
 * - Never on Vercel serverless (no Chromium) — leave jobs pending for local/Fly worker
 * - Never when WORKER_DRY_RUN=true
 * - Otherwise on when PLAYWRIGHT_ENABLED is not explicitly "false"
 *   (default: run for real so you don't flip flags every time)
 */
export function canExecuteBrowserJobs() {
  if (process.env.VERCEL === "1") return false;
  if (process.env.WORKER_DRY_RUN === "true") return false;
  if (process.env.PLAYWRIGHT_ENABLED === "false") return false;
  return true;
}

export function automationModeLabel() {
  if (process.env.WORKER_DRY_RUN === "true") return "dry_run" as const;
  if (process.env.VERCEL === "1") return "vercel_cron_only" as const;
  if (process.env.PLAYWRIGHT_ENABLED === "false") return "playwright_disabled" as const;
  return "armed" as const;
}

/** Errors that mean "try again later", not permanent failure. */
export function isRetryableJobError(message: string) {
  const m = message.toLowerCase();
  return (
    m.includes("not published") ||
    m.includes("no linkedin url") ||
    m.includes("missing linkedin post url") ||
    m.includes("cannot add second comment") ||
    m.includes("cannot add third comment")
  );
}
