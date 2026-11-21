# LinkedWin

A self-hosted LinkedIn content HQ: draft and plan posts, keep a content calendar
and library, and see what's working. Your published posts, impressions,
reactions, comments, reposts and follower count sync in automatically.

LinkedWin **never posts for you**. You publish on LinkedIn yourself; LinkedWin
reads your own activity page and matches what went out to what you planned.

## What you get

- **Composer**: drafts with planned dates, pinned-comment drafts, media and quick-insert voice chips
- **Calendar and Library**: plan, reschedule and browse everything you've written or published
- **Overview and Data**: impressions, engagement rate, top hashtags and follower growth over time
- **Radar and Engage**: curated niche posts and engagement ideas
- **Activity sync**: a scheduled GitHub Action that pulls in your published posts and their metrics

## Set up your own LinkedWin (about 15 minutes)

You need GitHub, [Vercel](https://vercel.com) (free Hobby plan works), [Turso](https://turso.tech) (free) and Node 22+ on your computer.

### 1. Get the code

Click **Use this template** (or fork) on GitHub, then clone your copy:

```bash
git clone https://github.com/<you>/linkedwin && cd linkedwin
npm install
```

### 2. Create a database

```bash
turso db create linkedwin
turso db show linkedwin --url        # → LIBSQL_URL
turso db tokens create linkedwin     # → LIBSQL_AUTH_TOKEN
```

Copy `.env.example` to `.env.local` and fill in `APP_PASSWORD`, `LIBSQL_URL` and `LIBSQL_AUTH_TOKEN`.

### 3. Deploy the dashboard

In Vercel: **Add New → Project → import your repo**, then add these environment variables:

| Variable | Value |
| --- | --- |
| `APP_PASSWORD` | the password you'll log in with |
| `LIBSQL_URL`, `LIBSQL_AUTH_TOKEN` | from step 2 |
| `CRON_SECRET` | any random string |

Then **Storage → Create → Blob** and connect it to the project; that sets `BLOB_READ_WRITE_TOKEN` for media uploads. Redeploy.

### 4. Connect LinkedIn (read-only)

```bash
npm run session:capture
```

A browser opens. Log in with **email + password** (Google sign-in is blocked in
automated browsers). The session is saved to your database, so the dashboard and
the sync job both use it. It's also written to `linkedin-session.json`, which is gitignored.

### 5. Turn on automatic sync

In your GitHub repo: **Settings → Secrets and variables → Actions**, add
`LIBSQL_URL` and `LIBSQL_AUTH_TOKEN`. Then **Actions → LinkedIn activity sync →
Run workflow** with `scrolls` set to `30` to backfill. After that it runs every 6 hours.

Open your Vercel URL, log in, and the Overview's setup checklist shows anything
still missing. Set your name, headline and insert chips under **Settings → Profile & voice**.

## Running locally

```bash
npm run dev                              # http://localhost:3000
npm run activity:sync -- --dry           # preview a sync without writing
npm run activity:sync                    # sync now
```

Without `LIBSQL_URL`, local dev uses `./data/linkedwin.db`. Run `npm run db:seed` for demo data.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dashboard |
| `npm run activity:sync` | Pull posts and metrics (`--dry`, `--scrolls N`) |
| `npm run session:capture` | Log in to LinkedIn and store the session |
| `npm run import:linkedin -- <file.xlsx>` | Import a LinkedIn creator analytics export for history |
| `npx tsx scripts/import-account-export.ts <Rich_Media.csv>` | Import photo/video posts from a LinkedIn data export |
| `npm run db:seed` | Demo data |

## How sync works, and its limits

- It opens `linkedin.com/in/me/recent-activity/all/` with your stored session and
  reads only your own posts: each one carries an "analytics" link that identifies it.
- New posts are added. A planned post that you then published (matched by caption
  within about a week) is marked **published** with its real URL. Metrics are
  stored as snapshots only when they change.
- **It's scraping.** LinkedIn's terms don't allow automated access, and they change
  their markup often. Keep the interval long (6h is the default). If the page
  structure changes, update the selectors in `worker/activity-sync.ts`.
- LinkedIn may challenge a login from GitHub's data-centre IPs. If runs start
  failing with "session expired", run `npm run session:capture` again. You can also
  skip the Action and run `npm run activity:sync` locally.
- GitHub pauses scheduled workflows in repos with no activity for 60 days. Re-enable it under Actions.

## Optional: Zernio analytics

If you already use [Zernio](https://zernio.com), add `ZERNIO_API_KEY` and
`ZERNIO_LINKEDIN_ACCOUNT_ID` (or set them in Settings). A daily Vercel cron then
pulls Zernio's follower stats and post analytics. LinkedWin only reads from Zernio.

## Tech stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind v4 · Turso/libSQL with
Drizzle · Vercel Blob · Playwright (activity sync) · GitHub Actions (schedule) ·
Recharts, GSAP, lucide-react.
