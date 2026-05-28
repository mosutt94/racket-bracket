create type tournament_instance_status as enum ('scheduled', 'draw_pending', 'draw_partial', 'draw_ready', 'in_progress', 'completed');
create type provider_sync_status as enum ('success', 'failed', 'running');
create type provider_sync_type as enum ('calendar', 'draw', 'match_updates', 'manual');
create type manual_override_type as enum ('match_winner', 'match_score', 'player_slot');
create type draw_side as enum ('top', 'bottom');

create table tournament_instances (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slam_type slam_type not null,
  year integer not null,
  gender tournament_gender not null,
  status tournament_instance_status not null default 'scheduled',
  bracket_size integer not null default 128,
  qualifying_starts_at timestamptz not null,
  main_draw_starts_at timestamptz not null,
  final_starts_at timestamptz not null,
  provider_name text not null,
  external_provider_id text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique(slam_type, year, gender)
);

alter table tournaments
  add column if not exists tournament_instance_id uuid references tournament_instances(id);

create table pool_tournaments (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references pools(id) on delete cascade,
  tournament_id uuid not null references tournaments(id) on delete cascade,
  tournament_instance_id uuid not null references tournament_instances(id) on delete cascade,
  picking_deadline timestamptz not null,
  locked_at timestamptz,
  commissioner_notes text,
  created_at timestamptz not null default now(),
  unique(pool_id, tournament_instance_id)
);

create table draw_slots (
  id uuid primary key default gen_random_uuid(),
  tournament_instance_id uuid not null references tournament_instances(id) on delete cascade,
  position integer not null check (position between 1 and 128),
  side draw_side not null,
  section integer not null,
  seed integer,
  player_id uuid not null references players(id),
  placeholder_label text,
  resolved_at timestamptz,
  external_provider_slot_id text,
  updated_at timestamptz not null default now(),
  unique(tournament_instance_id, position)
);

alter table matches
  add column if not exists tournament_instance_id uuid references tournament_instances(id),
  add column if not exists player1_draw_slot_id uuid references draw_slots(id),
  add column if not exists player2_draw_slot_id uuid references draw_slots(id),
  add column if not exists winner_draw_slot_id uuid references draw_slots(id);

create table provider_sync_runs (
  id uuid primary key default gen_random_uuid(),
  tournament_instance_id uuid not null references tournament_instances(id) on delete cascade,
  tournament_id uuid references tournaments(id) on delete cascade,
  provider_name text not null,
  sync_type provider_sync_type not null,
  status provider_sync_status not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error_message text,
  raw_snapshot_id uuid references live_score_snapshots(id)
);

create table manual_overrides (
  id uuid primary key default gen_random_uuid(),
  tournament_instance_id uuid not null references tournament_instances(id) on delete cascade,
  tournament_id uuid references tournaments(id) on delete cascade,
  match_id uuid references matches(id) on delete cascade,
  draw_slot_id uuid references draw_slots(id) on delete cascade,
  override_type manual_override_type not null,
  locked boolean not null default true,
  value jsonb not null default '{}'::jsonb,
  created_by_user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index tournament_instances_dates_idx on tournament_instances(main_draw_starts_at, final_starts_at);
create index pool_tournaments_pool_id_idx on pool_tournaments(pool_id);
create index draw_slots_instance_position_idx on draw_slots(tournament_instance_id, position);
create index matches_instance_idx on matches(tournament_instance_id);
create index provider_sync_runs_instance_idx on provider_sync_runs(tournament_instance_id, started_at desc);
create index manual_overrides_match_idx on manual_overrides(match_id, locked);
