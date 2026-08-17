-- Adds the swap_counts column plans use to rate-limit single-exercise swaps
-- to 2 per week. Shape: { "<week_number>": <count> }, e.g. { "3": 2, "5": 1 }.
-- Reuses the existing plan-level JSONB pattern (checkins.completed_exercises)
-- rather than a new table — there is no migration tooling wired up in this
-- repo yet, so this file is applied manually in the Supabase SQL editor.

alter table public.plans
  add column if not exists swap_counts jsonb not null default '{}'::jsonb;
