# Racket Bracket

Private Grand Slam tennis bracket pools — a March Madness-style pool against a 128-player Grand Slam draw (64 first-round matches, 127 total). Built on Next.js 14 (App Router) with Supabase for persistence and ESPN's tennis feed for live data.

## Quick start

```bash
npm install
# Add Supabase env vars to .env.local (see "Configuration" below), then:
npm run dev
```

Open http://localhost:3000. Sign in with any email + name; the app creates your profile in Supabase on the fly.

## Configuration

Required env vars in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Supabase is the only persistence layer — the app refuses to boot without these.

## Database

Three migrations in `supabase/migrations/`:

1. `001_initial_schema.sql` — base schema (pools, brackets, matches, players, etc.)
2. `002_live_grand_slam_lifecycle.sql` — `tournament_instances`, `pool_tournaments`, `draw_slots`, `provider_sync_runs`, `manual_overrides`
3. `003_shared_tournament_per_slam.sql` — drops the per-pool clone model; enforces one tournament row per (slam_type, year, gender)

Apply with the Supabase CLI:

```bash
supabase db push
```

Or paste each migration into the Supabase SQL editor.

## How a commissioner uses it

1. Sign in at `/auth`
2. **Create a bracket** at `/pools/create` — pick the Grand Slam, year, and draw (men's/women's). The app calls ESPN to import the published 128-player draw on the spot.
3. Share the invite link (shown on the bracket's dashboard) with friends. They sign in with their own email and submit picks.
4. As matches complete, click **Apply ESPN results** in the admin page to pull winners, advance the bracket, and award points.
5. Leaderboard updates automatically as results come in.

If ESPN hadn't published the draw at creation time, the bracket exists but is empty until you trigger a re-import (currently via `POST /api/admin/live-feed/import-draw` — no UI yet).

## Data source

[`EspnTennisProvider`](lib/providers/espn-tennis-provider.ts) is the only tennis data provider. It scrapes ESPN's public scoreboard + bracket pages for the four Grand Slams (configs hard-coded for Australian Open, French Open, Wimbledon, US Open). The feed is community-maintained on the ESPN side, treat it as experimental.

## Scripts

```bash
npm run dev        # local dev server (http://localhost:3000)
npm run build      # production build
npm run start      # serve production build
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
```

No test runner is configured.

## Deployment

The project is deployed on Vercel — every push to `main` auto-deploys to https://racket-bracket.vercel.app. Env vars are mirrored from `.env.local` into the Vercel project settings.
