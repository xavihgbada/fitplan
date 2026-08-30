import { createClient } from "@supabase/supabase-js";
import { verifyUnsubscribeToken } from "./_lib/reminderToken.js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Reached by a plain-text link in the reminder email footer, clicked with no
// Supabase session available — the HMAC token is what proves the click is for
// this user's own account rather than trusting a bare userId query param.
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  res.setHeader("Content-Type", "text/plain; charset=utf-8");

  const { searchParams } = new URL(req.url, "http://localhost");
  const userId = searchParams.get("userId");
  const token = searchParams.get("token");
  if (!verifyUnsubscribeToken(userId, token)) {
    return res.status(403).send("This unsubscribe link is invalid.");
  }

  await supabaseAdmin.from("profiles").update({ email_reminders_enabled: false }).eq("id", userId);

  res.status(200).send("You've been unsubscribed from check-in reminder emails. You can keep using FitPlan AI as normal.");
}
