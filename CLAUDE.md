# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Racket Bracket** — Next.js 14 (App Router, TypeScript, Tailwind) MVP for private Grand Slam tennis bracket pools. Behaves like a March Madness pool against a 128-player Grand Slam draw (64 first-round matches, 127 total).

Demo invite code: `CLAY26` (seeded French Open 2026 men's pool).

## Commands

```bash
npm run dev           # next dev — runs at http://localhost:3000
npm run build         # next build
npm run start         # next start
npm run lint          # next lint (eslint-config-next, core-web-vitals)
npm run typecheck     # tsc --noEmit (strict mode)
npm run seed:supabase # node scripts/seed-supabase.mjs — seeds Roland Friends 2026 pool
```

No test runner is configured. Path alias `@/*` resolves to repo root.

## Dual-mode persistence (critical architecture)

The app runs in two interchangeable modes depending on env vars:

- **Demo mode** (no Supabase env vars): all state lives in `localStorage` via [lib/demo-store.ts](lib/demo-store.ts), seeded from [lib/seed.ts](lib/seed.ts) (`initialState`). Mutations are synchronous client-side reducers (e.g. `createPool`, `submitBracket`).
- **Supabase mode** (`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` set): API routes under [app/api/](app/api) delegate to [lib/supabase/persistence.ts](lib/supabase/persistence.ts), which talks to PostgreSQL via the service-role client in [lib/supabase/server.ts](lib/supabase/server.ts).

The client decides at runtime via [lib/app-state-client.ts](lib/app-state-client.ts): it fetches `/api/state`, falls back to `loadState()` on failure, and mirrors the server response into `localStorage`. UI components are written against the same `AppState` shape ([lib/types.ts](lib/types.ts)) in both modes — keep that contract intact when adding fields.

The route layer is intentionally separated from bracket UI components so the next auth pass can swap demo user IDs for real Supabase session users without touching the UI.

## Service layer

Business logic lives in pure functions under [lib/services/](lib/services), takes `AppState` in, returns `AppState` out — no I/O. Both demo and Supabase modes call them.

- [bracket-service.ts](lib/services/bracket-service.ts) — bracket draft/submit/lock + pick propagation
- [scoring-service.ts](lib/services/scoring-service.ts) — recalculates `bracketPicks.isCorrect`, `pointsAwarded`, and bracket `totalScore` from `tournament_rounds` points per round when match winners change. Called by every mutation that can change a winner.
- [sync-service.ts](lib/services/sync-service.ts) — pulls from a `TennisDataProvider`, merges into `state.matches`, appends a `liveScoreSnapshot`, then calls `recalculateScores`.
- [tournament-lifecycle-service.ts](lib/services/tournament-lifecycle-service.ts) — Grand Slam activation, staged draw sync, qualifier/lucky-loser resolution.
- [espn-mapping-service.ts](lib/services/espn-mapping-service.ts) — maps ESPN payloads onto draw slots.

## Provider abstraction

Tennis data sources implement [`TennisDataProvider`](lib/providers/tennis-data-provider.ts) (`getTournamentDraw`, `getLiveMatches`, `getCompletedMatches`, plus lifecycle methods). Concrete providers in [lib/providers/](lib/providers): `MockTennisDataProvider` (default, drives the seeded 128-player draw), `EspnTennisProvider`, `TennisApiProvider` (RapidAPI, gated on `TENNIS_API_RAPIDAPI_KEY`). Selection is centralized in [provider-service.ts](lib/providers/provider-service.ts) — register new providers there. The real-provider live-feed route is currently preview-only (`/api/admin/live-feed`); it does not mutate the seeded bracket.

## Schema

Two migrations in [supabase/migrations/](supabase/migrations):

1. `001_initial_schema.sql` — pools, members, tournaments, rounds, players, matches, brackets, bracket_picks, profiles.
2. `002_live_grand_slam_lifecycle.sql` — canonical `tournament_instances`, pool activations, `draw_slots`, `provider_sync_runs`, `manual_overrides` (admin edits win over future provider syncs).

Apply with `supabase db push` (Supabase CLI required). After migrations run `npm run seed:supabase`.

## Routes

Pages under [app/](app); admin tooling lives at `app/pools/[poolId]/admin`. JSON API under [app/api/](app/api): `pools`, `join-pool`, `brackets`, `state`, `live-scores`, `admin/{matches,sync,recalculate,live-feed}`. All admin mutation routes go through [lib/supabase/persistence.ts](lib/supabase/persistence.ts) when Supabase is configured.

## Conventions

- Strict TypeScript; `AppState` is the single source of truth for shape. When adding a new entity, extend `AppState` in [lib/types.ts](lib/types.ts), seed it in [lib/seed.ts](lib/seed.ts), map it in both `mapXxx` helpers and `getAppStateFromSupabase` in [lib/supabase/persistence.ts](lib/supabase/persistence.ts), and add the column to the appropriate migration.
- ID generation: `makeId(prefix)` from [lib/utils.ts](lib/utils.ts) for demo mode; Supabase generates UUIDs server-side.
- Components import via the `@/` alias, not relative paths.
- Demo mode must keep working — never gate UI features behind Supabase env vars; gate persistence instead.
