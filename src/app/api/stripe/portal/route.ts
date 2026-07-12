import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });

  let body: { email?: string };
  try {
    body = (await req.json()) as { email?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim();
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const stripe = new Stripe(secret);
  const customers = await stripe.customers.list({ email, limit: 1 });
  const customerId = customers.data[0]?.id;
  if (!customerId) {
    return NextResponse.json({ error: "No billing account found for this email" }, { status: 404 });
  }

  const origin = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/pricing`,
  });

  return NextResponse.json({ url: portal.url });
}
