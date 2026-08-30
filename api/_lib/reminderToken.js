import crypto from "node:crypto";

// Lets an unauthenticated email-link click (no Supabase session available)
// flip one user's email_reminders_enabled flag, without letting anyone flip
// an arbitrary other user's flag. Deliberately reuses SUPABASE_SERVICE_ROLE_KEY
// as the HMAC secret rather than adding a dedicated env var — the worst case
// of this token leaking is someone else's reminder emails get turned off, not
// a real security boundary, so a second secret isn't worth the extra config.
export function unsubscribeToken(userId) {
  return crypto.createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY).update(userId).digest("hex");
}

export function verifyUnsubscribeToken(userId, token) {
  if (!userId || !token) return false;
  const expected = Buffer.from(unsubscribeToken(userId));
  const given = Buffer.from(String(token));
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}
