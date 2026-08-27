-- Move the US Open 2026 picking auto-lock from 6am ET to 11am ET Sunday —
-- exactly first ball (Session 1, Louis Armstrong / Grandstand, 11:00 AM ET).
-- Commissioner's request: give members all of Sunday morning to finish their
-- brackets; no information advantage exists before the first match starts.
--
-- Guarded on the prior 10:00 UTC value (idempotent, preserves any deadline a
-- commissioner customized by hand). Already applied to production directly.

update tournament_instances
set main_draw_starts_at = timestamptz '2026-08-30 15:00:00+00'
where slam_type = 'us_open' and year = 2026
  and main_draw_starts_at = timestamptz '2026-08-30 10:00:00+00';

update tournaments
set picking_deadline = timestamptz '2026-08-30 15:00:00+00'
where slam_type = 'us_open' and year = 2026
  and picking_deadline = timestamptz '2026-08-30 10:00:00+00';

update pool_tournaments pt
set picking_deadline = timestamptz '2026-08-30 15:00:00+00'
from tournaments t
where pt.tournament_id = t.id
  and t.slam_type = 'us_open' and t.year = 2026
  and pt.picking_deadline = timestamptz '2026-08-30 10:00:00+00';
