import { createClient } from "@supabase/supabase-js";
import { SWAPS_PER_WEEK } from "../../src/constants.js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Same "how many checkins exist for this plan, plus one" formula the
// frontend's loadCheckins/setCurrentWeek already uses for currentWeek —
// kept in sync deliberately rather than introducing a second way to
// compute it, since swap and adjustment must agree on what week it is.
async function getCurrentWeek(planId) {
  const { count } = await supabaseAdmin
    .from("checkins")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", planId);
  return (count || 0) + 1;
}

// Looks up the swap-limit state for one plan, scoped to the verified user's
// own plan (service-role client, keyed off the caller's verified id — never
// trusts a client-supplied planId's ownership without checking). Returns a
// ready-to-send rejection when the plan doesn't exist, isn't theirs, or the
// week's limit is already hit; otherwise the state needed to record a swap
// once the caller's Anthropic call actually succeeds.
export async function checkSwapLimit(userId, planId) {
  if (!planId || typeof planId !== "string") {
    return { allowed: false, status: 400, error: "Missing planId" };
  }

  const { data: plan } = await supabaseAdmin
    .from("plans")
    .select("user_id, swap_counts")
    .eq("id", planId)
    .single();

  if (!plan || plan.user_id !== userId) {
    return { allowed: false, status: 403, error: "Plan not found" };
  }

  const currentWeek = await getCurrentWeek(planId);
  const swapCounts = plan.swap_counts || {}; // {} for plans saved before swap_counts existed
  const usedThisWeek = swapCounts[currentWeek] || 0;

  if (usedThisWeek >= SWAPS_PER_WEEK) {
    return { allowed: false, status: 403, error: "Swap limit reached for this week — resets next week." };
  }

  return { allowed: true, planId, currentWeek, swapCounts };
}

// Call only after the swap actually succeeded — increments just the current
// week's count, leaving every other week's history in the JSON untouched.
export async function recordSwap({ planId, currentWeek, swapCounts }) {
  const updatedCounts = { ...swapCounts, [currentWeek]: (swapCounts[currentWeek] || 0) + 1 };
  await supabaseAdmin.from("plans").update({ swap_counts: updatedCounts }).eq("id", planId);
  return updatedCounts;
}
