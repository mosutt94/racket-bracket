# Racket Bracket

Racket Bracket is a production-oriented Next.js MVP for private Grand Slam tennis bracket pools. It behaves like a March Madness pool, but uses tennis tournament rounds, configurable scoring, pool invite codes, commissioner tools, mock live results, and a provider layer ready for a real tennis API.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The app runs immediately with local demo data. Use invite code `CLAY26` for the seeded French Open 2026 men's pool. The mock draw uses the real Grand Slam shape: 128 players, 64 first-round matches, and 127 total matches.

## What is included

- Next.js App Router, TypeScript, React, Tailwind CSS
- Mobile-friendly landing, auth, dashboard, pool, bracket, my bracket, leaderboard, admin, match management, and scoring settings pages
- Local demo auth/store so the MVP works before Supabase credentials exist
- Supabase client helpers and server persistence adapters in `lib/supabase`
- PostgreSQL migration in `supabase/migrations/001_initial_schema.sql`
- Seed/mock 128-player Grand Slam draw in `lib/seed.ts`
- Business logic split into services:
  - `lib/services/bracket-service.ts`
  - `lib/services/scoring-service.ts`
  - `lib/services/sync-service.ts`
  - `lib/services/tournament-lifecycle-service.ts`
  - `lib/providers/*`

## Supabase setup

Add environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Run both migrations:

```bash
supabase db push
```

`002_live_grand_slam_lifecycle.sql` adds canonical tournament instances, pool activations, draw slots, provider sync runs, and manual overrides.

Then seed a working demo pool and 128-player mock Grand Slam draw:

```bash
npm run seed:supabase
```

The seed creates `Roland Friends 2026` with invite code `CLAY26`, three demo profiles, French Open 2026 men's singles, 128 players, and 127 matches.

The app still boots with local demo data when Supabase variables are absent. When `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are present, these API routes use PostgreSQL-backed persistence:

- `GET/POST /api/pools` for listing and creating pools
- `POST /api/join-pool` for invite-code membership
- `GET/POST /api/brackets` for bracket drafts, submissions, and picks
- `POST /api/admin/matches` for commissioner match corrections and manual override audit records
- `POST /api/admin/sync` for provider sync run logging

The route layer is intentionally separated in `lib/supabase/persistence.ts` so the next auth pass can swap demo user IDs for real Supabase session users without touching bracket UI components.

## Scoring rules

Round scoring lives in `tournament_rounds` and is edited in the app at `/pools/[poolId]/settings`. The scoring algorithm lives in `lib/services/scoring-service.ts`. It recalculates bracket picks when match winners change and updates bracket totals.

## Tennis data providers

The provider interface is `lib/providers/tennis-data-provider.ts`:

```ts
interface TennisDataProvider {
  getTournamentDraw(tournamentConfig): Promise<DrawData>;
  getLiveMatches(tournamentId): Promise<LiveMatchData[]>;
  getCompletedMatches(tournamentId): Promise<CompletedMatchData[]>;
}
```

The current scoring implementation uses `MockTennisDataProvider`. It simulates upcoming Slam detection, partial draws with qualifier/lucky-loser placeholders, placeholder resolution, match updates, and provider health.

There is also a real-provider adapter at `lib/providers/tennis-api-provider.ts` for Tennis API on RapidAPI. It is currently used as a commissioner-facing preview so you can confirm that Roland Garros fixtures/results are reachable before importing a real draw into a pool.

To test the real provider, add:

```bash
TENNIS_API_RAPIDAPI_KEY=...
```

Then open the commissioner dashboard and click **Check real feed**. The app calls `/api/admin/live-feed`, discovers the Grand Slam season from the Tennis API tournament calendar, and previews fixture/result counts plus sample matches. It intentionally does not mutate the seeded bracket yet, because real live data must be matched to a real imported draw before scoring should trust it.

To plug in a free or paid provider:

1. Create a provider class implementing `TennisDataProvider`.
2. Implement upcoming Slam discovery, tournament instance lookup, staged draw sync, match updates, and provider health.
3. Register it in `lib/providers/provider-service.ts`.
4. Store provider config in `tennis_data_providers`.
5. Have the sync route call the registered provider and persist sync runs in `provider_sync_runs`.

Free APIs should be evaluated for Grand Slam draw completeness, stable match IDs, qualifier placeholders, and result latency before relying on them. If a free provider is incomplete, keep it behind the provider interface and use a paid/trial provider. A commissioner-facing import flow can be added as an outage fallback, but the normal admin path should remain bracket-based editing rather than raw JSON.

## Commissioner/admin features

Commissioner tools live under `app/pools/[poolId]/admin`:

- Submission tracker
- Leaderboard and member score visibility
- Lock/unlock picking
- Manual match winner updates
- Mock live sync button
- Sync snapshot status
- Scoring settings before tournament start
- Next Grand Slam activation
- Staged draw/results sync
- Qualifier/lucky-loser resolution status
- Bracket-based player and winner corrections
- Manual override audit records where admin edits win over future provider syncs

## Development phases

Phase 1 through Phase 5 are represented in the codebase as an MVP path:

1. App, auth placeholder, schema, seed data, pool create/join, fake 128-player tournament bracket
2. Bracket picks, draft save, submission, lock behavior
3. Manual match winners, scoring, leaderboard
4. Mock live provider, sync button, live score snapshots
5. Provider interface and docs for real tennis API integration
