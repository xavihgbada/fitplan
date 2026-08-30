import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { isCheckInDue, CHECKIN_INTERVAL_DAYS } from "../src/recommendations.js";
import { unsubscribeToken } from "./_lib/reminderToken.js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const resend = new Resend(process.env.RESEND_API_KEY);

const REMINDER_COOLDOWN_MS = CHECKIN_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
const APP_URL = process.env.APP_URL || "https://fitplan-lake.vercel.app";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "FitPlan AI <onboarding@resend.dev>";

// Triggered by vercel.json's daily cron. Not a per-user endpoint — there's no
// caller session to verify, so instead this checks the header Vercel itself
// automatically attaches to a scheduled Cron Job invocation once CRON_SECRET
// is set as a project env var. Rejects everyone else, since this sends real
// email and writes to plans/profiles with no other request-level auth possible.
export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).end();
  const authHeader = req.headers.authorization || "";
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Optional ?planId= scopes the run to one plan — the real daily cron never
  // passes this (vercel.json's schedule has no query string), but it's how a
  // manual re-run targets a single plan instead of every overdue plan in the
  // table, whether that's for a controlled test or recovering one failed send.
  const { searchParams } = new URL(req.url, "http://localhost");
  const onlyPlanId = searchParams.get("planId");

  let plansQuery = supabaseAdmin.from("plans").select("id, user_id, created_at, last_reminder_sent_at");
  if (onlyPlanId) plansQuery = plansQuery.eq("id", onlyPlanId);
  const { data: plans, error: plansError } = await plansQuery;
  if (plansError) return res.status(500).json({ error: plansError.message });

  const results = { sent: 0, skipped: 0, failed: 0 };

  // ponytail: one round of queries per plan (checkin lookup, profile lookup,
  // user lookup), not batched — fine at this app's scale, revisit with joined/
  // batched queries if the plans table ever grows large enough for this cron
  // to run long.
  for (const plan of plans || []) {
    try {
      const { data: latestCheckin } = await supabaseAdmin
        .from("checkins")
        .select("created_at")
        .eq("plan_id", plan.id)
        .order("week_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Same "last checkin, or plan creation if none yet" rule the check-in
      // button's own enabled state uses (App.jsx's lastActivityDate) — kept in
      // sync via the shared isCheckInDue import, not reimplemented here.
      const lastActivityDate = latestCheckin?.created_at
        ? new Date(latestCheckin.created_at)
        : new Date(plan.created_at);
      if (!isCheckInDue(lastActivityDate)) { results.skipped++; continue; }

      // A reminder already sent for this same overdue period — don't send
      // another one every day it stays overdue.
      if (plan.last_reminder_sent_at && Date.now() - new Date(plan.last_reminder_sent_at).getTime() < REMINDER_COOLDOWN_MS) {
        results.skipped++;
        continue;
      }

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("email_reminders_enabled")
        .eq("id", plan.user_id)
        .single();
      if (profile?.email_reminders_enabled === false) { results.skipped++; continue; }

      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(plan.user_id);
      const email = userData?.user?.email;
      if (!email) { results.skipped++; continue; }

      const unsubscribeUrl = `${APP_URL}/api/unsubscribe-reminders?userId=${plan.user_id}&token=${unsubscribeToken(plan.user_id)}`;

      const { error: sendError } = await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: "Your weekly check-in is ready",
        text: `Time for your weekly check-in on FitPlan AI. Log what you did this week and get your plan adjusted for the next one.\n\n${APP_URL}\n\n---\nDon't want these emails? Turn off reminders: ${unsubscribeUrl}`,
      });
      if (sendError) {
        console.error("send-checkin-reminders: Resend error for plan", plan.id, sendError);
        results.failed++;
        continue;
      }

      await supabaseAdmin.from("plans").update({ last_reminder_sent_at: new Date().toISOString() }).eq("id", plan.id);
      results.sent++;
    } catch (e) {
      console.error("send-checkin-reminders: error on plan", plan.id, e);
      results.failed++;
    }
  }

  res.status(200).json(results);
}
