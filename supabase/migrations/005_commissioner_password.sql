-- Commissioner password: a nullable hash on profiles.
--   NULL     => password-less account (regular participant, or a commissioner
--               who hasn't set one yet -> eligible for first-time-set).
--   NOT NULL => protected account; signing in by this email requires the password.
-- Hashing is done in Node (scrypt); this column only stores the result.
alter table profiles add column if not exists password_hash text;
