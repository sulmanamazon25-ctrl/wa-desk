import { NextResponse } from "next/server";
import Stripe from "stripe";
import { billingEnabled, stripePriceId, appOrigin } from "@/lib/billing-config";

export const runtime = "nodejs";

const PLANS = ["pro", "business", "lifetime"] as const;

export async function POST(req: Request) {
  if (!billingEnabled()) {
    return NextResponse.json({ error: "Billing not configured" }, { status: 503 });
  }

  const secret = process.env.STRIPE_SECRET_KEY!.trim();
  const stripe = new Stripe(secret);

  let body: { plan?: string; email?: string };
  try {
    body = (await req.json()) as { plan?: string; email?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const plan = (body.plan ?? "").toLowerCase();
  if (!PLANS.includes(plan as (typeof PLANS)[number])) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const priceId = stripePriceId(plan);
  if (!priceId) {
    return NextResponse.json({ error: `Missing Stripe price for plan: ${plan}` }, { status: 500 });
  }

  const origin = appOrigin();
  const mode = plan === "lifetime" ? "payment" : "subscription";

  const session = await stripe.checkout.sessions.create({
    mode,
    customer_email: body.email?.trim() || undefined,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/download?checkout=success`,
    cancel_url: `${origin}/pricing?checkout=cancel`,
    metadata: { plan },
    subscription_data:
      mode === "subscription"
        ? { metadata: { plan } }
        : undefined,
    payment_intent_data:
      mode === "payment"
        ? { metadata: { plan } }
        : undefined,
  });

  return NextResponse.json({ url: session.url });
}
