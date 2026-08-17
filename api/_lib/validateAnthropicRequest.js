// Pins every part of an Anthropic request body an authenticated caller shouldn't
// be able to control — without this, a direct POST to one of these endpoints
// (not just the real frontend) could swap in a different model, inflate
// max_tokens, or replace the system prompt entirely, turning the server's
// Anthropic key into a free-for-all proxy while the app's own credit
// accounting still only counts it as one action. `content` (the single
// user message) is genuinely per-request data built from the caller's own
// form/plan/check-in history, so it's only length-capped, not pinned.
//
// allowedProfiles is a list of { model, maxTokens, system } combinations this
// endpoint may legitimately receive — most endpoints have exactly one, but
// api/adjust-plan.js handles two (the real weekly adjustment and the
// single-exercise swap, which share an endpoint but use different prompts).
const MAX_CONTENT_LENGTH = 100000;

export function validateAnthropicRequest(body, allowedProfiles) {
  if (!body || typeof body !== "object") return "Invalid request body";
  if (!Array.isArray(body.messages) || body.messages.length !== 1) return "Invalid messages";

  const [message] = body.messages;
  if (!message || message.role !== "user" || typeof message.content !== "string") return "Invalid message shape";
  if (message.content.length === 0 || message.content.length > MAX_CONTENT_LENGTH) return "Invalid message length";

  const matchesProfile = allowedProfiles.some(
    p => body.model === p.model && body.max_tokens === p.maxTokens && body.system === p.system
  );
  if (!matchesProfile) return "Invalid request parameters";

  return null;
}
