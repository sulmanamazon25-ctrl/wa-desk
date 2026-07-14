#!/usr/bin/env node
/**
 * Merge .env.billing.local Stripe/Resend vars into API server deploy/wa-desk/.env and recreate wa-desk.
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const billingLocal = path.join(root, ".env.billing.local");

const BILLING_KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_PRO_MONTHLY",
  "STRIPE_PRICE_BUSINESS_YEARLY",
  "STRIPE_PRICE_LIFETIME",
  "RESEND_API_KEY",
  "CONTACT_FROM_EMAIL",
  "CONTACT_INBOX_EMAIL",
  "NEXT_PUBLIC_APP_URL",
  "DOWNLOAD_URL",
  "CORS_ALLOWED_ORIGINS",
];

const SSH_HOST = process.env.WA_API_SSH_HOST || "194.9.62.143";
const SSH_KEY =
  process.env.WA_API_SSH_KEY ||
  (process.platform === "win32"
    ? `${process.env.USERPROFILE}\\.ssh\\euronode_key`
    : `${process.env.HOME}/.ssh/euronode_key`);

async function main() {
  if (!existsSync(billingLocal)) {
    console.error("Missing .env.billing.local — copy from .env.billing.local.example");
    process.exit(1);
  }
  dotenv.config({ path: billingLocal });

  const defaults = {
    NEXT_PUBLIC_APP_URL: "https://wasup.app",
    DOWNLOAD_URL: "https://wasup.app/download",
    CORS_ALLOWED_ORIGINS: "https://wasup.app,https://www.wasup.app",
    CONTACT_FROM_EMAIL: "WhatsApp AI Desk <hello@wasup.app>",
    CONTACT_INBOX_EMAIL: "support@wasup.app",
  };

  const vars = { ...defaults };
  for (const k of BILLING_KEYS) {
    const v = process.env[k]?.trim();
    if (v) vars[k] = v;
  }

  if (!vars.STRIPE_SECRET_KEY || !vars.STRIPE_WEBHOOK_SECRET) {
    console.error("Need STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in .env.billing.local");
    console.error("Run: npm run setup:stripe");
    process.exit(1);
  }

  const patchLines = Object.entries(vars)
    .map(([k, v]) => `if grep -q '^${k}=' deploy/wa-desk/.env 2>/dev/null; then sed -i 's|^${k}=.*|${k}=${v.replace(/'/g, "'\\''")}|' deploy/wa-desk/.env; else echo '${k}=${v.replace(/'/g, "'\\''")}' >> deploy/wa-desk/.env; fi`)
    .join("\n");

  const remoteScript = `
set -euo pipefail
cd /opt/wa-desk
test -f deploy/wa-desk/.env || { echo "missing .env"; exit 1; }
${patchLines}
cd deploy/wa-desk
docker compose --env-file .env up -d --force-recreate wa-desk
sleep 4
curl -sS -o /dev/null -w "checkout:%{http_code}\\n" -X POST http://127.0.0.1:3025/api/stripe/checkout -H "Content-Type: application/json" -d '{"plan":"pro"}'
`;

  console.log(`Deploying billing env to ${SSH_HOST}...`);

  await new Promise((resolve, reject) => {
    const child = spawn(
      "ssh",
      ["-i", SSH_KEY, "-o", "StrictHostKeyChecking=no", `root@${SSH_HOST}`, remoteScript],
      { stdio: "inherit", shell: process.platform === "win32" },
    );
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`ssh exit ${code}`))));
  });

  console.log("Done. Run: npm run verify:billing");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
