-- Record when a Slam finishes so the app can move concluded brackets into a
-- "History" section a few days after they wrap.
--
-- A tournament is considered complete when its whole draw is decided (every
-- match completed). The results sync sets this timestamp the first time it
-- observes a fully-decided draw; it is never cleared once set.
alter table tournaments add column if not exists completed_at timestamptz;
