-- Weekly check-in email reminders (api/send-checkin-reminders.js, run daily
-- via Vercel Cron). last_reminder_sent_at gates the cron to one reminder per
-- overdue period, not once per day it stays overdue. email_reminders_enabled
-- is the unsubscribe flag, flipped by api/unsubscribe-reminders.js — defaults
-- to true so existing users keep getting reminders unless they opt out.
-- No migration tooling wired up in this repo yet, so this file is applied
-- manually in the Supabase SQL editor.

alter table public.plans
  add column if not exists last_reminder_sent_at timestamptz;

alter table public.profiles
  add column if not exists email_reminders_enabled boolean not null default true;
