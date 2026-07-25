/**
 * Restore LinkedIn Playwright session from linkedin-session.json into the DB.
 *
 * Usage:
 *   npx tsx scripts/restore-linkedin-session.ts [path/to/session.json]
 */
import fs from "node:fs";
import path from "node:path";
import { normalizeLinkedInSessionInput } from "../src/lib/linkedin-session";
import { getSetting, setSetting } from "../src/lib/settings";

async function main() {
  const file =
    process.argv[2] ?? path.join(process.cwd(), "linkedin-session.json");
  if (!fs.existsSync(file)) {
    throw new Error(`Session file not found: ${file}`);
  }

  const raw = fs.readFileSync(file, "utf8");
  const normalized = normalizeLinkedInSessionInput(raw);
  await setSetting("linkedin_session", normalized);
  await setSetting("session_health", "healthy");

  const check = await getSetting("linkedin_session");
  const parsed = JSON.parse(check!);
  console.log(
    JSON.stringify(
      {
        file,
        cookies: Array.isArray(parsed.cookies) ? parsed.cookies.length : 0,
        origins: Array.isArray(parsed.origins) ? parsed.origins.length : 0,
        sessionHealth: await getSetting("session_health"),
        storedChars: check!.length,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
