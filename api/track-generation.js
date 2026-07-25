import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "Missing userId" });

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