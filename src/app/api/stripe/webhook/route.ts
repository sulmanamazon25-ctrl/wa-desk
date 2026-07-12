import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createLicenseRecordAsync } from "@/lib/server/license-db";
import { planExpiresAt } from "@/lib/server/license-crypto";
import { licensePurchaseEmailHtml, sendResendEmail } from "@/lib/server/resend-mail";
import { downloadUrl } from "@/lib/billing-config";
import type { LicensePlan } from "../../../../../shared/license";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret || !whSecret) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const raw = await req.text();
  const stripe = new Stripe(secret);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, whSecret);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Webhook error" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const email = session.customer_details?.email || session.customer_email || "";
    const plan = (session.metadata?.plan || "pro") as LicensePlan;
    if (!email) {
      console.error("[stripe] checkout completed without email", session.id);
      return NextResponse.json({ received: true });
    }

    const expiresAt = planExpiresAt(plan);
    const { key } = await createLicenseRecordAsync({
      email,
      plan,
      stripeSessionId: session.id,
      expiresAt,
    });

    const dl = downloadUrl();
    await sendResendEmail({
      to: email,
      subject: "Your WhatsApp AI Desk license key",
      html: licensePurchaseEmailHtml({ licenseKey: key, plan, downloadUrl: dl }),
    });
  }

  return NextResponse.json({ received: true });
}
