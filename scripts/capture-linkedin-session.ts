/**
 * Headed browser: log into LinkedIn manually, then save storage state JSON.
 *
 * Usage:
 *   npm run session:capture
 *
 * Opens Chromium → log in with email/password (not Google) → when the feed
 * loads, storage is written to linkedin-session.json and imported into Settings.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { normalizeLinkedInSessionInput } from "../src/lib/linkedin-session";
import { setSetting } from "../src/lib/settings";

const OUT = path.join(process.cwd(), "linkedin-session.json");

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("https://www.linkedin.com/login", {
    waitUntil: "domcontentloaded",
  });

  console.log("\nLog in with email + password in the browser window.");
  console.log("Do NOT use Continue with Google — it breaks in automated browsers.");
  console.log("Waiting until you reach the feed…\n");

  await page.waitForURL(/linkedin\.com\/(feed|checkpoint)/, {
    timeout: 10 * 60 * 1000,
  });

  if (page.url().includes("checkpoint")) {
    console.log("Security checkpoint — finish verification in the browser…");
    await page.waitForURL(/linkedin\.com\/feed/, {
      timeout: 10 * 60 * 1000,
    });
  }

  await new Promise((r) => setTimeout(r, 2000));
  const state = await context.storageState();
  const normalized = normalizeLinkedInSessionInput(state);
  fs.writeFileSync(OUT, JSON.stringify(JSON.parse(normalized), null, 2));
  await setSetting("linkedin_session", normalized);
  await setSetting("session_health", "healthy");

  console.log(`Saved ${OUT}`);
  console.log("Also imported into Settings (session_health=healthy).\n");

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
