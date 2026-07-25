# LinkedWin

Personal LinkedIn Content HQ.

## Stack

- **Next.js** (App Router) on Vercel
- **SQLite** (`data/linkedwin.db`) via `@libsql/client` — zero-cost personal DB (Neon-ready later)
- **Zernio** for schedule / documents / `firstComment` / analytics
- **Fly worker + Playwright** for 12h native self-repost (and optional second comments)

## Quick start

```bash
npm install
cp .env.example .env.local
# set APP_PASSWORD
npm run db:seed
npm run dev
```

Login at http://localhost:3000/login with `APP_PASSWORD` (default in example: `linkedwin`).

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local dashboard |
| `npm run build` | Production build |
| `npm run db:seed` | Demo posts, radar, engage recs |
| `npm run worker` | Process due automation jobs |
| `npm run worker:dry` | Process jobs without Playwright |

## Env

See `.env.example`. Critical:

- `APP_PASSWORD` — gate for the personal dashboard
- `ZERNIO_API_KEY` + `ZERNIO_LINKEDIN_ACCOUNT_ID` — publishing
- `CRON_SECRET` — protects `/api/cron/*` and `/api/worker/run`
- `PLAYWRIGHT_ENABLED=true` on the Fly worker only

## Architecture

1. **Composer** schedules a post → local DB + Zernio (`firstComment` in platformSpecificData)
2. **Calendar** table edits date/time → PATCH schedule (syncs Zernio when connected)
3. **Jobs**: `repost` at publish+12h; optional `second_comment`
4. **Cron** (Vercel): metrics sync every 4h; worker poll every 15m
5. **Radar / Engage**: curated tables; score offline with Claude/Gemini → `POST /api/engage`

## Figma

https://www.figma.com/design/UqIRLh3FLJGrQUVTCDszLk/LinkedWin

## Notion

- Spec: https://app.notion.com/p/3a729a7538718174b410e98a724ca6b0
- Plan: https://app.notion.com/p/3a729a753871818588b9cb443da96e65

## Capture LinkedIn session (worker)

1. Locally: `npx playwright codegen linkedin.com` (log in)
2. Export storage state JSON
3. POST to `/api/settings` with `{ "linkedinSession": "<json>", "sessionHealth": "healthy" }`

## Gotchas

- Zernio LinkedIn: put links in `firstComment`, not the caption
- Document posts need `documentTitle` / media title
- Native repost is ToS-gray — keep to 1/day
- SQLite file must be writable; on Vercel use a remote DB or volume — for personal use prefer a small always-on host or migrate to Neon
