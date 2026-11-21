# LinkedWin

Self-hosted LinkedIn content HQ: plan, draft and analyze posts. **It never publishes,
comments or reposts** — users post on LinkedIn themselves and activity sync reads it back.
Designed as a template: anyone clones it, adds their own Turso DB + LinkedIn session, and runs it.

## Stack

- **Next.js** (App Router) on Vercel
- **libSQL / SQLite** via `@libsql/client` + Drizzle — local `data/linkedwin.db` in dev; **Turso** in production so Vercel and the sync Action share data
- **Vercel Blob** for Composer media (`BLOB_READ_WRITE_TOKEN`)
- **Playwright** activity sync, scheduled by **GitHub Actions** (`.github/workflows/linkedin-sync.yml`)
- **Zernio** — optional, read-only analytics add-on

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local dashboard |
| `npm run build` | Production build |
| `npm run activity:sync -- --dry` | Scrape own LinkedIn activity → show changes (drop `--dry` to apply, `--scrolls N` to dig back) |
| `npm run session:capture` | Headed login → saves Playwright storageState to the DB |
| `npm run import:linkedin -- <xlsx>` | Import LinkedIn creator analytics export |
| `npm run db:seed` | Demo data |

Every script imports `scripts/_env.ts` first so it loads `.env.local` (and hits the same DB as the app).

## Architecture

1. **Composer** saves drafts / planned posts locally (`src/lib/posts.ts`). Status: `draft` → `scheduled` (= planned) → `published`
2. **Calendar** reschedules planned posts (local only)
3. **Activity sync** (`worker/activity-sync.ts` scrape → `src/lib/activity-ingest.ts` upsert): new posts inserted; planned/lossy rows matched by caption (±7d planned, ±2d published) get the live caption, URL and `published`; metrics snapshotted when changed; followers + display name recorded
4. **Profile & voice** (`src/lib/profile.ts`, settings keys `profile_name`, `profile_headline`, `voice_inserts`) — per-install, edited in Settings; client reads via `useProfile()`
5. **Zernio** (optional): daily `/api/cron/metrics` no-ops without a key
6. **Radar / Engage**: curated tables; score offline → `POST /api/engage`

## Env

See `.env.example`. `APP_PASSWORD` (required in prod), `LIBSQL_URL` + `LIBSQL_AUTH_TOKEN`, `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`. Actions secrets: `LIBSQL_URL`, `LIBSQL_AUTH_TOKEN`.

## Gotchas

- Session capture: email + password only — Google blocks OAuth in automated browsers
- LinkedIn's 2026 frontend has no `data-urn` cards: sync keys off `a[href*="/analytics/post-summary/urn:li:activity:"]` (own posts only) + `[data-testid="expandable-text-box"]`; `/recent-activity/shares/` crashes, use `/all/`
- Social counts are the text of the action buttons (`Reaction button state…`/`Comment`/`Repost` aria-labels); empty = 0
- No named functions inside `page.$$eval` callbacks — tsx injects `__name()`, which doesn't exist in the page
- `/posts/…-share-<id>` URLs hold a share id, not the activity id — match on `activity:` ids only
- Activity ids encode publish time: `Number(BigInt(id) >> 22n)` ms
- Don't spoof user agents or call LinkedIn's internal API directly; read the rendered page only
- `automation_jobs` table is legacy (posting removed) — created for old DBs, unused
- Personal one-offs live in gitignored `local/`; keep the template free of personal paths
