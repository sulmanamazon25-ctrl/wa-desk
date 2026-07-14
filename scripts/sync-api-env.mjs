#!/usr/bin/env node
/**
 * Push deploy/wa-desk/coolify-env-paste.txt → API server /opt/wa-desk/deploy/wa-desk/.env
 * Use after pasting live Stripe + Resend keys into coolify-env-paste.txt (gitignored secrets).
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const pasteFile = path.join(root, "deploy", "wa-desk", "coolify-env-paste.txt");

const SSH_HOST = process.env.WA_API_SSH_HOST || "194.9.62.143";
const SSH_KEY =
  process.env.WA_API_SSH_KEY ||
  (process.platform === "win32"
    ? `${process.env.USERPROFILE}\\.ssh\\euronode_key`
    : `${process.env.HOME}/.ssh/euronode_key`);

function parseEnv(text) {
  const vars = {};
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    vars[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return vars;
}

async function main() {
  if (!existsSync(pasteFile)) {
    console.error(`Missing ${pasteFile}`);
    process.exit(1);
  }
  const raw = await readFile(pasteFile, "utf8");
  const vars = parseEnv(raw);

  const required = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_PRO_MONTHLY"];
  const missing = required.filter((k) => !vars[k]);
  if (missing.length) {
    console.error("coolify-env-paste.txt missing live keys:", missing.join(", "));
    console.error("Copy your Coolify Environment block into deploy/wa-desk/coolify-env-paste.txt first.");
    process.exit(1);
  }

  if (!vars.STRIPE_SECRET_KEY.startsWith("sk_live_")) {
    console.warn("Warning: STRIPE_SECRET_KEY does not start with sk_live_ — you said you use live keys.");
  }

  // Normalize wasup.app
  vars.NEXT_PUBLIC_APP_URL = vars.NEXT_PUBLIC_APP_URL || "https://wasup.app";
  vars.DOWNLOAD_URL = vars.DOWNLOAD_URL || "https://wasup.app/download";
  vars.CORS_ALLOWED_ORIGINS = vars.CORS_ALLOWED_ORIGINS || "https://wasup.app,https://www.wasup.app";

  const envBody = Object.entries(vars)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const localTmp = path.join(tmpdir(), "wa-desk.env");
  await writeFile(localTmp, envBody + "\n");

  console.log(`Syncing ${Object.keys(vars).length} vars to ${SSH_HOST}...`);

  await new Promise((resolve, reject) => {
    const scp = spawn(
      "scp",
      ["-i", SSH_KEY, "-o", "StrictHostKeyChecking=no", localTmp, `root@${SSH_HOST}:/opt/wa-desk/deploy/wa-desk/.env`],
      { stdio: "inherit", shell: process.platform === "win32" },
    );
    scp.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`scp exit ${code}`))));
  });

  const remoteScript = `
set -euo pipefail
cd /opt/wa-desk/deploy/wa-desk
docker compose --env-file .env up -d --force-recreate wa-desk
sleep 5
curl -sS -o /dev/null -w "checkout:%{http_code}\\n" -X POST http://127.0.0.1:3025/api/stripe/checkout -H "Content-Type: application/json" -d '{"plan":"pro"}'
`;

  await new Promise((resolve, reject) => {
    const ssh = spawn(
      "ssh",
      ["-i", SSH_KEY, "-o", "StrictHostKeyChecking=no", `root@${SSH_HOST}`, remoteScript],
      { stdio: "inherit", shell: process.platform === "win32" },
    );
    ssh.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`ssh exit ${code}`))));
  });

  console.log("\nDone. Run: npm run verify:billing");
  console.log("Live webhook URL: https://api.wasup.app/api/stripe/webhook");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
