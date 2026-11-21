/**
 * Read-only LinkedIn browser context built from the stored session
 * (Settings → LinkedIn session, or `npm run session:capture`).
 * Used by activity sync; never posts, comments or reposts.
 */
import { getSetting, setSetting } from "../src/lib/settings";

type BrowserContext = {
  newPage: () => Promise<{
    goto: (url: string, opts?: { waitUntil?: string }) => Promise<unknown>;
    getByRole: (
      role: string,
      opts?: { name?: RegExp },
    ) => {
      first: () => {
        click: (opts?: { timeout?: number }) => Promise<void>;
        fill: (text: string) => Promise<void>;
        isVisible: () => Promise<boolean>;
      };
    };
    waitForTimeout: (ms: number) => Promise<void>;
  }>;
  storageState: () => Promise<unknown>;
  close: () => Promise<void>;
};

async function loadPlaywright() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("playwright") as {
      chromium: {
        launch: (opts: { headless: boolean }) => Promise<{
          newContext: (opts: { storageState: unknown }) => Promise<BrowserContext>;
          close: () => Promise<void>;
        }>;
      };
    };
  } catch {
    throw new Error(
      "playwright is not installed. Run: npm i -D playwright && npx playwright install chromium",
    );
  }
}

export async function withContext<T>(fn: (ctx: BrowserContext) => Promise<T>) {
  const raw = await getSetting("linkedin_session");
  const { parseStoredLinkedInSession } = await import(
    "../src/lib/linkedin-session"
  );
  const storage = parseStoredLinkedInSession(raw);
  if (!storage) {
    await setSetting("session_health", "expired");
    throw new Error(
      "LinkedIn browser session missing/corrupted — paste fresh storageState JSON in Settings",
    );
  }

  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({
    headless: process.env.PLAYWRIGHT_HEADLESS !== "false",
  });
  try {
    const ctx = await browser.newContext({ storageState: storage });
    const result = await fn(ctx);
    const next = await ctx.storageState();
    // Always persist via JSON.stringify — never String(next)
    await setSetting("linkedin_session", JSON.stringify(next));
    await setSetting("session_health", "healthy");
    await ctx.close();
    return result;
  } catch (err) {
    // Only auth failures mean the session is bad; selector/timeouts are page-shape issues
    const msg = err instanceof Error ? err.message : String(err);
    if (/session expired|login|authwall|checkpoint/i.test(msg)) {
      await setSetting("session_health", "expired");
    }
    throw err;
  } finally {
    await browser.close();
  }
}
