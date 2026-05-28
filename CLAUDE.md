# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Racket Bracket** — Next.js 14 (App Router, TypeScript, Tailwind) app for private Grand Slam tennis bracket pools. Behaves like a March Madness pool against a 128-player Grand Slam draw (64 first-round matches, 127 total). Supabase-required; ESPN's community-maintained feed is the only data source.

Deployed at https://racket-bracket.vercel.app (auto-deploys on push to `main`).

## Commands

```bash
npm run dev        # next dev — http://localhost:3000
npm run build      # next build
npm run start      # next start
npm run lint       # next lint (eslint-config-next, core-web-vitals)
npm run typecheck  # tsc --noEmit (strict mode)
```

No test runner is configured. Path alias `@/*` resolves to repo root.

## Hard requirements

- **Supabase env vars** in `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). All three migrations applied (`supabase db push` or via Studio).
- All API routes return 500 with "Supabase is not configured" if the env vars are missing — there is no demo / localStorage fallback.

## Architecture: shared-tournament-per-Slam

The big architectural decision (migration 003): **one tournament + 127 matches per `(slam_type, year, gender)`**, shared across any pools picking that Slam. Originally the codebase cloned the bracket per-pool; that was wasteful and was removed.

Implications when extending:
- `tournaments` table has a UNIQUE constraint on `(slam_type, year, gender)`. Code paths that touch tournaments must lookup-or-create against this key, not create blindly.
- `tournaments.pool_id` no longer exists — never reintroduce it. To find a pool's tournament, go through `pool_tournaments` (helper: `findTournamentForPool` in [lib/state-helpers.ts](lib/state-helpers.ts)).
- `brackets` and `bracket_picks` still reference matches by id, so they keep working — picks just resolve to the shared match.
- `tournament_rounds` (with `points_per_correct_pick`) is per-tournament, so scoring lives with the shared Slam too.

## Service layer

Pure functions under [lib/services/](lib/services), takes `AppState` in, returns `AppState` out — no I/O.

- [bracket-service.ts](lib/services/bracket-service.ts) — draft/submit picks + propagation
- [scoring-service.ts](lib/services/scoring-service.ts) — recalculates `bracketPicks.isCorrect`, `pointsAwarded`, and bracket `totalScore` from `tournament_rounds` points when winners change
- [bracket-shell-service.ts](lib/services/bracket-shell-service.ts) — pure 128-slot / 127-match bracket-shape generator + Slam calendar defaults. Used by `createGrandSlamBracketForPool` in persistence.
- [espn-mapping-service.ts](lib/services/espn-mapping-service.ts) — maps ESPN scoreboard payloads onto draw slots (used by the admin re-import endpoint)

## Persistence

[lib/supabase/persistence.ts](lib/supabase/persistence.ts) is the only file that writes to Postgres. Key entry points:

- `createPool` / `createPoolByEmail` — creates pool + attaches it to the (shared) tournament. First pool for a Slam triggers `createGrandSlamBracketForPool` which builds rounds + 128 players + 128 draw_slots + 127 matches once, then calls `importEspnDrawInSupabase`. Subsequent pools just attach.
- `getOrCreateProfileByEmailAndAuthenticate` — used by `/api/auth/identify` for sign-in
- `importEspnDrawInSupabase` — fetches ESPN's bracket HTML, fills R1 players + match IDs. Idempotent. Parallelizes ~320 row updates via `Promise.all`.
- `syncEspnLiveUpdatesInSupabase` — pulls ESPN scoreboard, applies winners, advances `next_match_id` chain, calls `recalculateTournamentScoresInSupabase`.
- `setTournamentStatusInSupabase` / `updateTournamentScoringInSupabase` — commissioner controls used by the admin and settings pages.
- `getAppStateFromSupabase` — fetches ALL rows for all 13 tables into a single `AppState`. **This is a known scaling issue** — every page load pulls every pool's data. Uses `fetchAllRows` pagination on matches + bracket_picks to get past PostgREST's 1000-row response cap. Scope down per-pool when adding new features at scale.

## Provider

[`EspnTennisProvider`](lib/providers/espn-tennis-provider.ts) is the only registered provider. Key methods:

- `getDrawImportData({ slamType, year, gender })` — scrapes `espn.com/tennis/<slug>/bracket/...`, returns 64 round-1 matchups
- `getDrawMatchLinks(...)` — returns all 127 match IDs across rounds 1-7 from the same HTML
- `getPreviewMatches(...)` / `getLiveMatches` / `getCompletedMatches` — pull ATP + WTA scoreboards in parallel and dedupe

## Routes

Pages in [app/](app). Admin tools live at `app/pools/[poolId]/admin`. JSON API in [app/api/](app/api):

- `auth/identify` — sign-in (find-or-create profile by email)
- `pools` GET/POST, `join-pool` POST, `brackets` GET/POST, `state` GET, `live-scores` GET
- `admin/{matches,sync,recalculate,scoring,tournament-status}` — commissioner mutations
- `admin/live-feed/import-draw` — emergency ESPN re-import (no UI, useful when ESPN published the draw after bracket creation)

## Identity

No real auth yet. [lib/current-user.ts](lib/current-user.ts) stores the signed-in profile in localStorage. The `/api/auth/identify` endpoint does `getOrCreateProfileByEmail` so the localStorage profile has a real Supabase id. [`getCurrentUserForState`](lib/app-state-client.ts) cross-references by email on every state load to stay canonical.

## Conventions

- Strict TypeScript. `AppState` ([lib/types.ts](lib/types.ts)) is the single source of truth for shape. When adding a new entity: extend `AppState`, add a `mapXxx` in `persistence.ts`, include it in `getAppStateFromSupabase`, and add the column in a new migration.
- Components import via `@/` alias, not relative paths.
- ID generation: pre-generate UUIDs client-side via [`createUuid`](lib/uuid.ts) when you need to wire up FK relationships in a single batch insert (see `insertBracketShellMatchesForTournament` — eliminates 127 sequential UPDATE round-trips).
- When adding bulk DB ops, prefer parallel `Promise.all` over sequential `await` per row — Supabase REST handles 100s of concurrent connections fine.

## Naming caveat

The UI calls things "brackets" but the code/DB still uses "pool" (`Pool`, `pools` table, `poolId`, `pool_tournaments`). The internal `Bracket` type already means "one user's filled-in picks for a tournament" so a Pool→Bracket rename would collide. Open: rename `Pool` to `League`/`Group`/`Contest` so the code matches the UI without collision.
