#!/usr/bin/env node
/**
 * Create Stripe products, prices, and webhook for WhatsApp AI Desk.
 * Reads STRIPE_SECRET_KEY from .env.billing.local or process.env.
 * Writes price IDs + webhook secret to .env.billing.local and coolify-env-paste.txt.
 */
import { readFile, writeFile, appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const billingLocal = path.join(root, ".env.billing.local");
const coolifyPaste = path.join(root, "deploy", "wa-desk", "coolify-env-paste.txt");

const WEBHOOK_URL = "https://api.wasup.app/api/stripe/webhook";

const PRODUCTS = [
  {
    name: "WhatsApp AI Desk Pro",
    description: "Monthly license — desktop WhatsApp AI assistant with BYOK OpenRouter.",
    envKey: "STRIPE_PRICE_PRO_MONTHLY",
    unit_amount: 2900,
    currency: "usd",
    recurring: { interval: "month" },
  },
  {
    name: "WhatsApp AI Desk Business",
    description: "Annual workspace license with onboarding support.",
    envKey: "STRIPE_PRICE_BUSINESS_YEARLY",
    unit_amount: 24900,
    currency: "usd",
    recurring: { interval: "year" },
  },
  {
    name: "WhatsApp AI Desk Lifetime",
    description: "One-time perpetual license for one workspace.",
    envKey: "STRIPE_PRICE_LIFETIME",
    unit_amount: 49900,
    currency: "usd",
    recurring: null,
  },
];

async function loadEnv() {
  if (existsSync(billingLocal)) {
    dotenv.config({ path: billingLocal });
  }
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    console.error("Missing STRIPE_SECRET_KEY.");
    console.error("Copy .env.billing.local.example → .env.billing.local and add your Stripe secret key.");
    process.exit(1);
  }
  return key;
}

async function readExistingBillingLocal() {
  if (!existsSync(billingLocal)) return {};
  const raw = await readFile(billingLocal, "utf8");
  const out = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

async function findOrCreatePrice(stripe, spec) {
  const products = await stripe.products.list({ limit: 100, active: true });
  let product = products.data.find((p) => p.name === spec.name);
  if (!product) {
    product = await stripe.products.create({
      name: spec.name,
      description: spec.description,
      metadata: { app: "whatsapp-ai-desk" },
    });
    console.log(`Created product: ${product.name} (${product.id})`);
  } else {
    console.log(`Found product: ${product.name} (${product.id})`);
  }

  const prices = await stripe.prices.list({ product: product.id, active: true, limit: 20 });
  const match = prices.data.find((pr) => {
    if (pr.unit_amount !== spec.unit_amount || pr.currency !== spec.currency) return false;
    if (spec.recurring) return pr.recurring?.interval === spec.recurring.interval;
    return !pr.recurring;
  });

  if (match) {
    console.log(`  Price: ${match.id} ($${spec.unit_amount / 100})`);
    return match.id;
  }

  const created = await stripe.prices.create({
    product: product.id,
    unit_amount: spec.unit_amount,
    currency: spec.currency,
    recurring: spec.recurring || undefined,
    metadata: { plan: spec.envKey },
  });
  console.log(`  Created price: ${created.id}`);
  return created.id;
}

async function findOrCreateWebhook(stripe) {
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  const existing = endpoints.data.find((e) => e.url === WEBHOOK_URL);

  if (existing) {
    await stripe.webhookEndpoints.update(existing.id, {
      enabled_events: ["checkout.session.completed"],
      disabled: false,
    });
    console.log(`Updated webhook: ${existing.id} → ${WEBHOOK_URL}`);
    console.log("  Reveal signing secret in Stripe Dashboard → Webhooks → this endpoint.");
    console.log("  (Stripe only shows whsec_ once at creation — if lost, delete & re-run this script.)");
    return null;
  }

  const ep = await stripe.webhookEndpoints.create({
    url: WEBHOOK_URL,
    enabled_events: ["checkout.session.completed"],
    description: "WhatsApp AI Desk license emails",
  });
  console.log(`Created webhook: ${ep.id}`);
  console.log(`  URL: ${WEBHOOK_URL}`);
  return ep.secret;
}

function mergeEnvLines(existing, updates) {
  const keys = new Set(Object.keys(updates));
  const lines = [];
  const seen = new Set();

  for (const line of existing.split("\n")) {
    const m = line.match(/^([A-Z_]+)=/);
    if (m && keys.has(m[1])) {
      lines.push(`${m[1]}=${updates[m[1]]}`);
      seen.add(m[1]);
    } else {
      lines.push(line);
    }
  }
  for (const [k, v] of Object.entries(updates)) {
    if (!seen.has(k)) lines.push(`${k}=${v}`);
  }
  return lines.join("\n");
}

async function updateCoolifyPaste(updates) {
  if (!existsSync(coolifyPaste)) {
    console.warn("coolify-env-paste.txt not found — skip merge");
    return;
  }
  const raw = await readFile(coolifyPaste, "utf8");
  let out = raw;
  for (const [k, v] of Object.entries(updates)) {
    const re = new RegExp(`^${k}=.*$`, "m");
    if (re.test(out)) {
      out = out.replace(re, `${k}=${v}`);
    } else {
      out += `\n${k}=${v}`;
    }
  }
  out = out
    .replace(/NEXT_PUBLIC_APP_URL=.*/g, "NEXT_PUBLIC_APP_URL=https://wasup.app")
    .replace(/DOWNLOAD_URL=.*/g, "DOWNLOAD_URL=https://wasup.app/download")
    .replace(/CORS_ALLOWED_ORIGINS=.*/g, "CORS_ALLOWED_ORIGINS=https://wasup.app,https://www.wasup.app");
  await writeFile(coolifyPaste, out.endsWith("\n") ? out : out + "\n");
  console.log(`Updated ${coolifyPaste}`);
}

async function main() {
  const secretKey = await loadEnv();
  const stripe = new Stripe(secretKey);
  const mode = secretKey.startsWith("sk_live") ? "LIVE" : "TEST";
  console.log(`Stripe mode: ${mode}\n`);

  const priceUpdates = {};
  for (const spec of PRODUCTS) {
    priceUpdates[spec.envKey] = await findOrCreatePrice(stripe, spec);
  }

  const webhookSecret = await findOrCreateWebhook(stripe);
  const updates = { ...priceUpdates };
  if (webhookSecret) {
    updates.STRIPE_WEBHOOK_SECRET = webhookSecret;
  }
  updates.STRIPE_SECRET_KEY = secretKey;

  const existing = await readExistingBillingLocal();
  const merged = { ...existing, ...updates };
  const body = Object.entries(merged)
    .filter(([k]) => !k.startsWith("#") && merged[k])
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  await writeFile(billingLocal, body + "\n");
  console.log(`\nWrote ${billingLocal}`);

  await updateCoolifyPaste(updates);

  console.log("\n--- Add to API server (if webhook secret not auto-filled) ---");
  console.log("STRIPE_WEBHOOK_SECRET=whsec_...  (from Stripe Dashboard if reusing endpoint)");
  for (const spec of PRODUCTS) {
    console.log(`${spec.envKey}=${priceUpdates[spec.envKey]}`);
  }
  console.log("\nNext: add RESEND_API_KEY to .env.billing.local, then:");
  console.log("  npm run deploy:billing-env");
  console.log("  npm run verify:billing");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
