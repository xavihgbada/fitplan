-- Adds the is_deload column checkins use to record whether the week being
-- reported on was a scheduled deload week (copied from the active plan's
-- is_deload_week flag at check-in time). This is what the plan-wide deload
-- trigger in src/recommendations.js (shouldTriggerDeload) scans to find the
-- most recent deload week and enforce the 4-week minimum spacing between
-- deloads — there is no migration tooling wired up in this repo yet, so this
-- file is applied manually in the Supabase SQL editor.

alter table public.checkins
  add column if not exists is_deload boolean not null default false;
