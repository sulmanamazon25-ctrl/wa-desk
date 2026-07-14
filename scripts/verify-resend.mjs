#!/usr/bin/env node
/** Send a test email via Resend using .env.billing.local */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const billingLocal = path.join(root, ".env.billing.local");

if (!existsSync(billingLocal)) {
  console.error("Missing .env.billing.local");
  process.exit(1);
}
dotenv.config({ path: billingLocal });

const apiKey = process.env.RESEND_API_KEY?.trim();
const from = process.env.CONTACT_FROM_EMAIL?.trim() || "WhatsApp AI Desk <onboarding@resend.dev>";
const to = process.argv[2] || process.env.CONTACT_INBOX_EMAIL?.trim();

if (!apiKey) {
  console.error("RESEND_API_KEY not set in .env.billing.local");
  process.exit(1);
}
if (!to) {
  console.error("Usage: node scripts/verify-resend.mjs your@email.com");
  process.exit(1);
}

const res = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from,
    to: [to],
    subject: "WhatsApp AI Desk — Resend test",
    html: "<p>Resend is configured correctly for wasup.app billing.</p>",
  }),
});

const text = await res.text();
if (!res.ok) {
  console.error(`Resend failed HTTP ${res.status}:`, text);
  process.exit(1);
}
console.log("Resend OK:", text);
