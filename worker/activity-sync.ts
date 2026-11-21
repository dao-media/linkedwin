/**
 * Scrape your own LinkedIn "Posts" activity tab with the stored session and
 * upsert anything LinkedWin is missing (native posts never pass through Zernio).
 *
 * Read-only on LinkedIn: no clicks besides "…more" caption expanders.
 */
import type { Page } from "playwright";
import { ingestActivities, type IngestResult, type ScrapedActivity } from "../src/lib/activity-ingest";
import { getSetting, setSetting } from "../src/lib/settings";
import { recordFollowerSnapshot } from "../src/lib/trends";
import { withContext } from "./linkedin-browser";

const LAST_RUN_KEY = "last_activity_sync_at";
const LAST_RESULT_KEY = "last_activity_sync_result";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitter = (base: number) => base + Math.floor(Math.random() * base);

const ANALYTICS_LINK = 'a[href*="/analytics/post-summary/urn:li:activity:"]';
const idFromHref = (href: string | null) => /urn:li:activity:(\d{19})/.exec(href ?? "")?.[1] ?? null;
const idToMs = (id: string) => Number(BigInt(id) >> BigInt(22));

/**
 * LinkedIn's 2026 React frontend: no data-urn cards. Only *your own* posts carry an
 * "analytics/post-summary/urn:li:activity:<id>" link, so that's both the id and the
 * ownership filter. The /recent-activity/shares/ tab currently crashes; /all/ renders.
 */
export async function scrape(page: Page, opts: { maxScrolls: number; stopBefore?: number }) {
  const slug = process.env.LINKEDIN_PROFILE_SLUG?.trim() || "me";
  await page.goto(`https://www.linkedin.com/in/${slug}/recent-activity/all/`, {
    waitUntil: "domcontentloaded",
  });
  if (/\/(login|authwall|checkpoint|uas\/)/.test(page.url())) {
    throw new Error(`LinkedIn session expired (redirected to ${new URL(page.url()).pathname})`);
  }
  const vanity = /\/in\/([^/]+)/.exec(page.url())?.[1] ?? slug;

  await page.waitForSelector(ANALYTICS_LINK, { timeout: 30_000 });

  let lastCount = 0;
  let stalls = 0;
  for (let i = 0; i < opts.maxScrolls; i++) {
    const hrefs = await page.$$eval(ANALYTICS_LINK, (els) => els.map((a) => a.getAttribute("href")));
    if (hrefs.length === lastCount && i > 0) {
      if (++stalls >= 2) break;
    } else {
      stalls = 0;
    }
    lastCount = hrefs.length;
    if (opts.stopBefore) {
      const ids = hrefs.map(idFromHref).filter((x): x is string => !!x);
      const oldest = Math.min(...ids.map(idToMs));
      if (oldest < opts.stopBefore) break;
    }
    // Feed may scroll an inner container, so bring the last post into view rather than wheel the window
    await page.locator(ANALYTICS_LINK).last().scrollIntoViewIfNeeded().catch(() => {});
    await page.mouse.wheel(0, 2500);
    const more = page.getByRole("button", { name: /show more results|load more/i }).first();
    if (await more.isVisible().catch(() => false)) await more.click().catch(() => {});
    await sleep(jitter(1500));
  }

  // Expand truncated captions ("… more")
  await page.$$eval('[data-testid="expandable-text-button"]', (els) =>
    els.forEach((b) => (b as HTMLElement).click()),
  );
  await sleep(800);

  const raw = await page.$$eval(ANALYTICS_LINK, (links) =>
    links.map((a) => {
      // Climb to the card root: the highest ancestor that still holds only this one post's analytics link
      let card: HTMLElement = a as HTMLElement;
      while (
        card.parentElement &&
        card.parentElement.querySelectorAll('a[href*="/analytics/post-summary/"]').length === 1
      ) {
        card = card.parentElement;
      }
      const textEl = card.querySelector('[data-testid="expandable-text-box"]') as HTMLElement | null;
      const imgs = [...card.querySelectorAll("img")]
        .map((i) => i.getAttribute("src") ?? "")
        .filter((src) => /media\.licdn\.com\/dms\/image/.test(src) && !/profile-displayphoto|company-logo/.test(src));
      const cardText = card.innerText;
      // Counts live on the action buttons themselves (empty text = 0):
      // "Reaction button state: Funny" / "React\u2026" \u2192 reactions, "Comment" \u2192 comments, "Repost" \u2192 reposts
      // (No named helpers in here: tsx injects __name(), which doesn't exist in the page)
      const buttons = [...card.querySelectorAll("button")];
      const counts = [/^(Reaction button state|React|Like)\b/i, /^Comment$/i, /^Repost$/i].map((re) => {
        const b = buttons.find((x) => re.test(x.getAttribute("aria-label") ?? ""));
        const t = (b?.textContent ?? "").replace(/[^\d]/g, "");
        return t ? Number(t) : 0;
      });
      const impressions = /([\d,]+)\s+impressions?/i.exec(cardText)?.[1];
      return {
        counts,
        impressions: impressions ? Number(impressions.replace(/,/g, "")) : null,
        href: a.getAttribute("href"),
        text: textEl?.innerText ?? "",
        image: imgs[0] ?? null,
        video: !!card.querySelector("video"),
        doc: /\bdocument\b|pages?\s*•|\d+\s+pages\b/i.test(card.querySelector("iframe")?.getAttribute("title") ?? ""),
        reposted: /reposted this/i.test(cardText.slice(0, 200)),
      };
    }),
  );

  const byId = new Map<string, ScrapedActivity>();
  for (const r of raw) {
    const activityId = idFromHref(r.href);
    if (!activityId || byId.has(activityId)) continue;
    const content = r.text
      .replace(/\s*…\s*(see )?more\s*$/i, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (!content) continue;
    byId.set(activityId, {
      activityId,
      content,
      mediaType: r.doc ? "document" : r.video ? "video" : r.image ? "image" : null,
      mediaUrl: r.image && !r.video && !r.doc ? r.image : null,
      metrics:
        r.impressions != null
          ? { impressions: r.impressions, reactions: r.counts[0] ?? 0, comments: r.counts[1] ?? 0, reposts: r.counts[2] ?? 0 }
          : null,
    });
  }
  const profile = await page.evaluate(() => {
    const followers = /Followers\s+([\d,]+)/.exec(document.body.innerText)?.[1];
    const label = document.querySelector('a[aria-label^="View "][aria-label$="profile"]')?.getAttribute("aria-label") ?? "";
    return {
      followers: followers ? Number(followers.replace(/,/g, "")) : null,
      name: /^View (.+?)[’']s profile$/.exec(label)?.[1] ?? null,
    };
  });
  return { vanity, items: [...byId.values()], profile };
}

export async function runActivitySync(opts: { dryRun?: boolean; maxScrolls?: number } = {}): Promise<
  IngestResult & { vanity: string; followers: number | null }
> {
  // Only scroll back ~3 days past the last sync (first run: full maxScrolls)
  const last = await getSetting(LAST_RUN_KEY);
  const stopBefore = last ? Date.parse(last) - 3 * 86_400_000 : undefined;
  const { vanity, items, profile } = await withContext(async (ctx) => {
    const page = (await ctx.newPage()) as unknown as Page;
    return scrape(page, { maxScrolls: opts.maxScrolls ?? 15, stopBefore });
  });
  const result = await ingestActivities(items, { dryRun: opts.dryRun });
  if (!opts.dryRun) {
    if (profile.followers) {
      const at = new Date().toISOString();
      await setSetting("linkedin_followers", String(profile.followers));
      await recordFollowerSnapshot(profile.followers, "linkedin", at);
    }
    // Fill the display name once; never overwrite what the user typed in Settings
    if (profile.name && !(await getSetting("profile_name"))) {
      await setSetting("profile_name", profile.name);
    }
  }
  return { ...result, vanity, followers: profile.followers };
}

/** Run a sync and record the outcome in settings (shown in Settings → Activity sync). */
export async function runAndRecordActivitySync(opts: { dryRun?: boolean; maxScrolls?: number } = {}) {
  const startedAt = new Date().toISOString();
  try {
    const result = await runActivitySync(opts);
    if (!opts.dryRun) {
      // Only advance on success so the scroll-back window never skips a gap
      await setSetting(LAST_RUN_KEY, startedAt);
      await setSetting(
        LAST_RESULT_KEY,
        JSON.stringify({ at: startedAt, ok: true, inserted: result.inserted.length, upgraded: result.upgraded.length, seen: result.seen }),
      );
    }
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await setSetting(LAST_RESULT_KEY, JSON.stringify({ at: startedAt, ok: false, error: message }));
    throw err;
  }
}
