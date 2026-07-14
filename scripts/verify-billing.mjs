#!/usr/bin/env node
/** Verify Stripe checkout + Resend/contact on live API */
const API = (process.argv[2] || process.env.WA_API_URL || "https://api.wasup.app").replace(/\/$/, "");
const SITE = (process.argv[3] || process.env.WA_SITE_URL || "https://wasup.app").replace(/\/$/, "");

let failed = 0;

async function check(label, fn) {
  try {
    await fn();
    console.log(`✓ ${label}`);
  } catch (e) {
    console.log(`✗ ${label} — ${e instanceof Error ? e.message : e}`);
    failed++;
  }
}

await check(`POST ${API}/api/stripe/checkout (pro)`, async () => {
  const res = await fetch(`${API}/api/stripe/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan: "pro", email: "test@example.com" }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 503) throw new Error("Billing not configured (503)");
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(body)}`);
  if (!body.url?.includes("checkout.stripe.com")) throw new Error("No checkout URL in response");
});

await check(`GET ${API}/api/license/validate`, async () => {
  const res = await fetch(`${API}/api/license/validate`);
  if (![401, 403].includes(res.status)) throw new Error(`HTTP ${res.status} (expected 401/403)`);
});

await check(`POST ${API}/api/contact`, async () => {
  const res = await fetch(`${API}/api/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Billing verify",
      email: "verify@wasup.app",
      message: "Automated billing verify — ignore",
    }),
  });
  if (res.status === 503) throw new Error("Contact not configured — add RESEND_API_KEY + CONTACT_INBOX_EMAIL");
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${t.slice(0, 120)}`);
  }
});

await check(`GET ${SITE}/pricing`, async () => {
  const res = await fetch(`${SITE}/pricing`);
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
});

console.log(failed ? `\n${failed} check(s) failed` : "\nAll billing checks passed");
console.log("\nStripe webhook must be: https://api.wasup.app/api/stripe/webhook");
console.log("Event: checkout.session.completed");
process.exit(failed ? 1 : 0);
