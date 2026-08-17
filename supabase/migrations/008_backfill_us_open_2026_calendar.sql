-- Backfill the corrected US Open 2026 calendar onto rows created before the fix.
--
-- Commit e8ce11f corrected the hardcoded us_open defaults (main draw Aug 25 ->
-- Aug 31, final Sep 7 -> Sep 13) but assumed "no US Open tournament instances
-- exist yet". One did: the US Open 2026 Men's instance was created 2026-06-18,
-- ~4 weeks before that fix, so it kept the wrong dates.
--
-- Left alone, mainDrawStartsAt/picking_deadline (which double as the picking
-- auto-lock) would have locked picking on Aug 25 — six days before R1, and
-- crucially BEFORE ESPN publishes the draw (~Aug 27-28). Because the draw-import
-- route refuses to run once picking has closed, the Slam would have been frozen
-- with all 128 slots still reading "TBD 1..128", unfixable through the UI.
--
-- Every UPDATE is guarded on the stale value, so this is a no-op on rows that
-- already carry the corrected dates (and safe to re-run).

-- 1. The shared per-Slam instance: the calendar of record.
update tournament_instances
set
  qualifying_starts_at = timestamptz '2026-08-25 10:00:00+00',
  main_draw_starts_at  = timestamptz '2026-08-31 10:00:00+00',
  final_starts_at      = timestamptz '2026-09-13 09:00:00+00'
where slam_type = 'us_open'
  and year = 2026
  and main_draw_starts_at = timestamptz '2026-08-25 10:00:00+00';

-- 2. tournaments.picking_deadline — what isTournamentPickingClosedInSupabase()
--    reads to decide both the pick lock and the draw-import freeze.
update tournaments
set picking_deadline = timestamptz '2026-08-31 10:00:00+00'
where slam_type = 'us_open'
  and year = 2026
  and picking_deadline = timestamptz '2026-08-25 10:00:00+00';

-- 3. Per-pool deadlines stamped from the old default at pool-creation time.
--    Guarded on the exact stale timestamp so a deadline a commissioner set
--    deliberately is never overwritten.
update pool_tournaments pt
set picking_deadline = timestamptz '2026-08-31 10:00:00+00'
from tournaments t
where pt.tournament_id = t.id
  and t.slam_type = 'us_open'
  and t.year = 2026
  and pt.picking_deadline = timestamptz '2026-08-25 10:00:00+00';
