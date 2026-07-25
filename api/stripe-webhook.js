import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = { api: { bodyParser: false } };

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const buf = await buffer(req);
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.client_reference_id;
    const type = session.metadata?.type;

    if (userId && type === "unlock") {
      await supabaseAdmin.from("profiles").upsert(
        { id: userId, has_paid: true },
        { onConflict: "id" }
      );
    }

    if (userId && type === "extra_generation") {
      const { data } = await supabaseAdmin
        .from("profiles")
        .select("generation_credits")
        .eq("id", userId)
        .single();
      const current = data?.generation_credits || 0;
      await supabaseAdmin
        .from("profiles")
        .update({ generation_credits: current + 1 })
        .eq("id", userId);
    }
  }

  res.status(200).json({ received: true });
}