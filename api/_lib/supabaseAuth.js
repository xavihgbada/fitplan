import { createClient } from "@supabase/supabase-js";

const supabaseAuthClient = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Verifies the caller's Supabase session from the Authorization header
// against Supabase Auth itself — never trusts a client-supplied user id.
// Returns the real, verified user object, or null if there's no valid session.
export async function getVerifiedUser(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!token) return null;

  const { data, error } = await supabaseAuthClient.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}
