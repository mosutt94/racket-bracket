-- Seed this after creating a Supabase auth user/profile, then replace the commissioner id below.
-- The running MVP also includes equivalent local seed data in lib/seed.ts.

insert into tennis_data_providers (name, enabled, config)
values ('MockTennisDataProvider', true, '{"mode":"deterministic-demo"}')
on conflict (name) do update set enabled = excluded.enabled, config = excluded.config;

-- See lib/seed.ts for deterministic ids and the full mock draw used by the local demo.
