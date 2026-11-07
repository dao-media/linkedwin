# LinkedWin

Personal LinkedIn Content HQ — schedule posts, first comments, 12h reposts, analytics, niche radar.

## Tech stack

**App**

- **Next.js 16** (App Router) + **React 19** + **TypeScript**, hosted on **Vercel**
- **Tailwind CSS v4**, **GSAP** (motion), **lucide-react** (icons)
- **Recharts** for the Data page charts
- **zod** (validation), **date-fns** (dates), **jose** (`APP_PASSWORD` session auth)

**Data**

- **Turso / libSQL** via `@libsql/client` + **Drizzle ORM**: local `data/linkedwin.db` in dev, a shared remote DB in production so Vercel and the Fly worker see the same data
- **Vercel Blob** for Composer media

**Publishing & automation**

- **Zernio API** for scheduling, document posts, the pinned `firstComment`, and analytics sync
- **Fly.io worker + Playwright** for the native 12h self-repost and optional second comments (uses a captured LinkedIn session)
- **Vercel Cron** for metrics sync (every 4h) and worker polling (every 15m), protected by `CRON_SECRET`

**Data imports & scripts**

- **tsx** runs the scripts in `scripts/`
- **xlsx** parses LinkedIn AggregateAnalytics / Content exports; **csv-parse** reads Favikon CSVs
- Missing captions are recovered from the JSON-LD on LinkedIn's public post pages

**Tooling**

- **ESLint**, **drizzle-kit**, **concurrently** (`npm run dev` runs web + worker together)

## Setup

```bash
npm install
cp .env.example .env.local
npm run db:seed
npm run dev
```

Open http://localhost:3000 — password from `APP_PASSWORD` (example default: `linkedwin`).

## Docs

See [CLAUDE.md](./CLAUDE.md) for architecture, env vars, and worker setup.

Figma: https://www.figma.com/design/UqIRLh3FLJGrQUVTCDszLk/LinkedWin
