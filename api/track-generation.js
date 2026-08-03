import { createClient } from "@supabase/supabase-js";
import { getVerifiedUser } from "./_lib/supabaseAuth.js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const user = await getVerifiedUser(req);
  if (!user) return res.status(401).json({ error: "Authentication required" });
  if (req.body?.userId && req.body.userId !== user.id) {
    return res.status(403).json({ error: "User mismatch" });
  }
  const userId = user.id;

  const { data } = await supabaseAdmin
    .from("profiles")
    .select("plans_generated")
    .eq("id", userId)
    .single();
  const current = data?.plans_generated || 0;

  await supabaseAdmin
    .from("profiles")
    .update({ plans_generated: current + 1 })
    .eq("id", userId);

  res.status(200).json({ plans_generated: current + 1 });
}
