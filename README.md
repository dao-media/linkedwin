# LinkedWin

Personal LinkedIn Content HQ — schedule posts, first comments, 12h reposts, analytics, niche radar.

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
