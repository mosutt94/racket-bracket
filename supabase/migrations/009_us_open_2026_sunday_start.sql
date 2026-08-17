-- US Open 2026 actually starts SUNDAY Aug 30, not Monday Aug 31.
--
-- Migration 008 corrected the stale Aug 25 dates using ESPN's bracket payload,
-- which stamps every first-round match "2026-08-31". That's a per-round
-- placeholder date, not the real schedule: usopen.org's session calendar shows
-- Men's/Women's 1st Round Session 1 on Sunday, August 30 (11am ET), with R1
-- spanning Sun-Tue in the 15-day format.
--
-- The picking deadline must precede FIRST ball, or members can watch all of
-- Sunday's results and still "pick" them Monday morning. Move the auto-lock to
-- Sun Aug 30 10:00 UTC (6am ET, five hours before Session 1).
--
-- Same discipline as 008: every UPDATE is guarded on the value it corrects, so
-- deliberately-customized deadlines survive and the migration is idempotent.

update tournament_instances
set main_draw_starts_at = timestamptz '2026-08-30 10:00:00+00'
where slam_type = 'us_open'
  and year = 2026
  and main_draw_starts_at = timestamptz '2026-08-31 10:00:00+00';

update tournaments
set picking_deadline = timestamptz '2026-08-30 10:00:00+00'
where slam_type = 'us_open'
  and year = 2026
  and picking_deadline = timestamptz '2026-08-31 10:00:00+00';

update pool_tournaments pt
set picking_deadline = timestamptz '2026-08-30 10:00:00+00'
from tournaments t
where pt.tournament_id = t.id
  and t.slam_type = 'us_open'
  and t.year = 2026
  and pt.picking_deadline = timestamptz '2026-08-31 10:00:00+00';
