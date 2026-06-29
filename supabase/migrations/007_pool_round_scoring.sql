-- Per-pool scoring overrides. Scoring (points per round) used to live only on the
-- shared tournament_rounds, so every pool on a Slam was forced to share it. This
-- table lets a pool define its own points per round. A pool with NO rows here
-- inherits the shared tournament_rounds values, so every existing pool is
-- unchanged (no backfill on purpose).
create table pool_round_scoring (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references pools(id) on delete cascade,
  round_number int not null,
  points_per_correct_pick int not null,
  created_at timestamptz not null default now(),
  unique(pool_id, round_number)
);
