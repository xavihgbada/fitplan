-- Adds the free_action_used column that makes plan generation and workout
-- grading mutually exclusive as a single shared free action for unpaid users.
-- Run this in the Supabase SQL editor before deploying the workout-grader
-- feature — there is no migration tooling wired up in this repo yet, so this
-- file is applied manually.

alter table public.profiles
  add column if not exists free_action_used text;

alter table public.profiles
  add constraint profiles_free_action_used_check
  check (free_action_used is null or free_action_used in ('plan', 'grade'));
