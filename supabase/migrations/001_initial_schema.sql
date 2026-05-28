create extension if not exists "pgcrypto";

create type pool_role as enum ('commissioner', 'member');
create type slam_type as enum ('australian_open', 'french_open', 'wimbledon', 'us_open');
create type tournament_gender as enum ('men', 'women');
create type tournament_status as enum ('setup', 'picking_open', 'locked', 'in_progress', 'completed');
create type match_status as enum ('scheduled', 'live', 'completed');
create type next_match_slot as enum ('player1', 'player2');
create type bracket_status as enum ('draft', 'submitted', 'locked');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table pools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  commissioner_user_id uuid not null references profiles(id) on delete cascade,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table pool_members (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references pools(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role pool_role not null default 'member',
  joined_at timestamptz not null default now(),
  unique(pool_id, user_id)
);

create table tournaments (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid references pools(id) on delete cascade,
  name text not null,
  slam_type slam_type not null,
  year integer not null,
  gender tournament_gender not null,
  status tournament_status not null default 'setup',
  bracket_size integer not null default 128,
  picking_deadline timestamptz,
  external_provider_id text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

create table tournament_rounds (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  round_number integer not null,
  round_name text not null,
  points_per_correct_pick integer not null,
  unique(tournament_id, round_number)
);

create table players (
  id uuid primary key default gen_random_uuid(),
  external_provider_id text,
  name text not null,
  country text,
  seed integer
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  round_number integer not null,
  match_number integer not null,
  player1_id uuid references players(id),
  player2_id uuid references players(id),
  winner_player_id uuid references players(id),
  status match_status not null default 'scheduled',
  start_time timestamptz,
  score_summary text,
  external_provider_match_id text,
  next_match_id uuid references matches(id),
  next_match_slot next_match_slot,
  updated_at timestamptz not null default now(),
  unique(tournament_id, round_number, match_number)
);

create table brackets (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references pools(id) on delete cascade,
  tournament_id uuid not null references tournaments(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  submitted_at timestamptz,
  locked_at timestamptz,
  total_score integer not null default 0,
  status bracket_status not null default 'draft',
  unique(pool_id, tournament_id, user_id)
);

create table bracket_picks (
  id uuid primary key default gen_random_uuid(),
  bracket_id uuid not null references brackets(id) on delete cascade,
  match_id uuid not null references matches(id) on delete cascade,
  picked_winner_player_id uuid not null references players(id),
  is_correct boolean,
  points_awarded integer not null default 0,
  unique(bracket_id, match_id)
);

create table score_events (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  match_id uuid not null references matches(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  bracket_pick_id uuid not null references bracket_picks(id) on delete cascade,
  points_awarded integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table live_score_snapshots (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  provider_name text not null,
  raw_payload jsonb not null,
  created_at timestamptz not null default now()
);

create table tennis_data_providers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index pool_members_user_id_idx on pool_members(user_id);
create index tournaments_pool_id_idx on tournaments(pool_id);
create index matches_tournament_id_idx on matches(tournament_id);
create index brackets_pool_tournament_idx on brackets(pool_id, tournament_id);
create index bracket_picks_bracket_id_idx on bracket_picks(bracket_id);
