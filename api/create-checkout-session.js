import Stripe from "stripe";
import { getVerifiedUser } from "./_lib/supabaseAuth.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICES = {
  unlock: { amount: 1900, name: "FitPlan AI — Unlock (3 plans, save & PDF export)" },
  extra_generation: { amount: 700, name: "FitPlan AI — Extra plan generation" },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const user = await getVerifiedUser(req);
  if (!user) return res.status(401).json({ error: "Authentication required" });
  if (req.body?.userId && req.body.userId !== user.id) {
    return res.status(403).json({ error: "User mismatch" });
  }

  const { type } = req.body;
  const chosen = PRICES[type];
  if (!chosen) return res.status(400).json({ error: "Invalid request" });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      client_reference_id: user.id,
      metadata: { type, userId: user.id },
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: { name: chosen.name },
            unit_amount: chosen.amount,
          },
          quantity: 1,
        },
      ],
      success_url: `${req.headers.origin}/?checkout=success&type=${type}`,
      cancel_url: `${req.headers.origin}/?checkout=cancel`,
    });
    res.status(200).json({ url: session.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
