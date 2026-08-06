import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const FREE_PLANS_INCLUDED = 3;

// Reads what's needed to decide whether a user may perform a paid action (generate or grade)
// right now. Always derived from the DB via a service-role client — callers must key this off
// the verified user id from getVerifiedUser, never a client-supplied id.
export async function getAccessState(userId) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("has_paid, generation_credits, plans_generated, free_action_used")
    .eq("id", userId)
    .single();

  return {
    hasPaid: !!data?.has_paid,
    freeActionUsed: data?.free_action_used || null,
    plansGenerated: data?.plans_generated || 0,
    totalAllowed: FREE_PLANS_INCLUDED + (data?.generation_credits || 0),
  };
}

// Unpaid users get exactly one free action total, shared between "plan" and "grade".
// Call only after the action has actually succeeded.
export async function markFreeActionUsed(userId, action) {
  await supabaseAdmin.from("profiles").update({ free_action_used: action }).eq("id", userId);
}

// Paid users spend from the same plans_generated/generation_credits pool regardless of
// action type. Call only after the action has actually succeeded.
export async function incrementPlansGenerated(userId) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("plans_generated")
    .eq("id", userId)
    .single();
  const next = (data?.plans_generated || 0) + 1;
  await supabaseAdmin.from("profiles").update({ plans_generated: next }).eq("id", userId);
  return next;
}
