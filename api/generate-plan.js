import { getVerifiedUser } from "./_lib/supabaseAuth.js";
import { getAccessState, markFreeActionUsed } from "./_lib/accessGate.js";
import { validateAnthropicRequest } from "./_lib/validateAnthropicRequest.js";
import { SYSTEM_PROMPT } from "../src/prompts.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const user = await getVerifiedUser(req);
  if (!user) return res.status(401).json({ error: "Authentication required" });

  const validationError = validateAnthropicRequest(req.body, [
    { model: "claude-sonnet-4-6", maxTokens: 8000, system: SYSTEM_PROMPT },
  ]);
  if (validationError) return res.status(400).json({ error: validationError });

  const access = await getAccessState(user.id);
  if (!access.hasPaid && access.freeActionUsed) {
    return res.status(402).json({ error: "You've used your free action — unlock to keep going." });
  }
  if (access.hasPaid && access.plansGenerated >= access.totalAllowed) {
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

  if (!access.hasPaid && response.ok) {
    await markFreeActionUsed(user.id, "plan");
  }

  res.status(200).json(data);
}