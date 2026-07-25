/**
 * LinkedIn browser automation for native repost + optional second comments.
 * Runs only when PLAYWRIGHT_ENABLED=true (Fly worker).
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

async function withContext<T>(fn: (ctx: BrowserContext) => Promise<T>) {
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
    await setSetting("session_health", "expired");
    throw err;
  } finally {
    await browser.close();
  }
}

export async function executeLinkedInRepost(payload: {
  postId: string;
  url: string | null;
}) {
  if (!payload.url) throw new Error("Missing LinkedIn post URL");
  await withContext(async (ctx) => {
    const page = await ctx.newPage();
    await page.goto(payload.url!, { waitUntil: "domcontentloaded" });
    const repost = page.getByRole("button", { name: /repost/i }).first();
    await repost.click({ timeout: 15000 });
    const confirm = page.getByRole("button", { name: /^repost$/i }).first();
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.click();
    }
    await page.waitForTimeout(2000);
  });
}

export async function executeLinkedInComment(payload: {
  url: string;
  comment: string;
}) {
  await withContext(async (ctx) => {
    const page = await ctx.newPage();
    await page.goto(payload.url, { waitUntil: "domcontentloaded" });
    const box = page
      .getByRole("textbox", { name: /comment|add a comment/i })
      .first();
    await box.click({ timeout: 15000 });
    await box.fill(payload.comment);
    const postBtn = page.getByRole("button", { name: /^post$/i }).first();
    await postBtn.click();
    await page.waitForTimeout(1500);
  });
}
