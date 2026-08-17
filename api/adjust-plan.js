import { getVerifiedUser } from "./_lib/supabaseAuth.js";
import { getAccessState, incrementPlansGenerated } from "./_lib/accessGate.js";
import { validateAnthropicRequest } from "./_lib/validateAnthropicRequest.js";
import { ADJUST_SYSTEM_PROMPT, SWAP_SYSTEM_PROMPT } from "../src/prompts.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const user = await getVerifiedUser(req);
  if (!user) return res.status(401).json({ error: "Authentication required" });

  // This endpoint handles two legitimate shapes: the real weekly adjustment
  // (ADJUST_SYSTEM_PROMPT) and the single-exercise swap (SWAP_SYSTEM_PROMPT) —
  // see buildSwapPrompt's caller in App.jsx, which also posts here.
  const validationError = validateAnthropicRequest(req.body, [
    { model: "claude-sonnet-4-6", maxTokens: 8000, system: ADJUST_SYSTEM_PROMPT },
    { model: "claude-sonnet-4-6", maxTokens: 300, system: SWAP_SYSTEM_PROMPT },
  ]);
  if (validationError) return res.status(400).json({ error: validationError });

  // Adjusting/swapping in an existing plan is paid-only — unlike generate/grade,
  // it was never one of the two free_action_used options (that column is DB-
  // constrained to 'plan' | 'grade' only), so an unpaid caller is rejected
  // outright rather than spending a free action that was never meant to cover this.
  const access = await getAccessState(user.id);
  if (!access.hasPaid) {
    return res.status(402).json({ error: "Unlock to adjust or swap exercises in your plan." });
  }

  const isFullAdjust = req.body.system === ADJUST_SYSTEM_PROMPT;
  // Only the full weekly adjustment draws from the shared credit pool — a
  // single-exercise swap stays unmetered for paid users, same as it's always
  // been, so this doesn't quietly start burning a full plan credit per swap.
  if (isFullAdjust && access.plansGenerated >= access.totalAllowed) {
    return res.status(402).json({ error: "You've used your included generations — buy another to keep going." });
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(req.body),
  });
  const data = await response.json();

  if (isFullAdjust && response.ok) {
    await incrementPlansGenerated(user.id);
  }

  res.status(200).json(data);
}