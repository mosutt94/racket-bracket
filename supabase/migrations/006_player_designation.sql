-- Manual entry label shown in the bracket where a seed number would go, for
-- unseeded players: Q (qualifier), WC (wild card), LL (lucky loser), etc.
-- ESPN's feed doesn't provide these, so commissioners enter them by hand.
-- A numeric seed always takes precedence over this label in the display.
alter table players add column if not exists designation text;
