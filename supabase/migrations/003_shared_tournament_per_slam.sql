-- Consolidate the per-pool-clone model into a shared tournament-per-Slam.
-- Before this migration: every pool got its own copy of (tournament + 127 matches + 7 rounds).
-- After this migration: one tournament + 127 matches per (slam_type, year, gender), shared
-- across any pools that pick that Slam. Brackets and picks already reference matches by id,
-- so they keep working — picks just resolve to the shared match.

-- Step 1: wipe all tournament data. Profiles intentionally preserved.
--
-- This is a destructive one-time consolidation. The app stays usable because brackets
-- get recreated through the normal "create bracket" flow afterward.
delete from provider_sync_runs;
delete from manual_overrides;
delete from live_score_snapshots;
delete from score_events;
delete from bracket_picks;
delete from brackets;
delete from matches;
delete from tournament_rounds;
delete from pool_tournaments;
delete from pool_members;
delete from tournaments;
delete from draw_slots;
delete from tournament_instances;
delete from players;
delete from pools;

-- Step 2: tournaments are no longer per-pool. Drop the legacy column and its index.
drop index if exists tournaments_pool_id_idx;
alter table tournaments drop column if exists pool_id;

-- Step 3: enforce one tournament row per Slam draw. Future bracket creations will
-- look up by this key and reuse the existing row instead of cloning.
alter table tournaments
  add constraint tournaments_slam_year_gender_unique unique (slam_type, year, gender);
