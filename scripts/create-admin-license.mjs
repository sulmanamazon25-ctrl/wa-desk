#!/usr/bin/env node
/**
 * Create a license via admin API. Reads .env.admin.local for ADMIN_API_KEY and WA_DESK_SERVER_URL.
 * Usage: node scripts/create-admin-license.mjs --email you@example.com --plan lifetime
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function loadAdminEnv() {
  const file = path.join(root, ".env.admin.local");
  if (!existsSync(file)) {
    console.error("Missing .env.admin.local — copy from .env.admin.local.example");
    process.exit(1);
  }
  const env = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const env = loadAdminEnv();
const apiKey = env.ADMIN_API_KEY;
const base = (env.WA_DESK_SERVER_URL || "http://localhost:3000").replace(/\/$/, "");
const email = arg("email") || env.ADMIN_EMAIL;
const plan = arg("plan") || "lifetime";

if (!apiKey) {
  console.error("ADMIN_API_KEY missing in .env.admin.local");
  process.exit(1);
}
if (!email) {
  console.error("Pass --email or set ADMIN_EMAIL in .env.admin.local");
  process.exit(1);
}

const res = await fetch(`${base}/api/admin/licenses`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ email, plan }),
});

const data = await res.json();
if (!res.ok) {
  console.error("Failed:", data);
  process.exit(1);
}

console.log("\nLicense created:");
console.log("  Email:", data.license?.email);
console.log("  Plan:", data.license?.plan);
console.log("  Key:", data.licenseKey);
console.log("\nSave this key — it is shown once.\n");
