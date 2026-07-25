import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICES = {
  unlock: { amount: 1900, name: "FitPlan AI — Unlock (3 plans, save & PDF export)" },
  extra_generation: { amount: 700, name: "FitPlan AI — Extra plan generation" },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { userId, type } = req.body;

  const chosen = PRICES[type];
  if (!userId || !chosen) return res.status(400).json({ error: "Invalid request" });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      client_reference_id: userId,
      metadata: { type, userId },
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
      success_url: `${req.headers.origin}/?checkout=success`,
      cancel_url: `${req.headers.origin}/?checkout=cancel`,
    });
    res.status(200).json({ url: session.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}