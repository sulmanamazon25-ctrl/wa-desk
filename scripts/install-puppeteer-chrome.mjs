import { accessSync } from "node:fs";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function exists(p) {
  try {
    accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function bundledChromePath() {
  try {
    const puppeteer = require("puppeteer");
    const p = puppeteer.executablePath();
    return exists(p) ? p : null;
  } catch {
    return null;
  }
}

const existing = bundledChromePath();
if (existing) {
  console.log(`[setup:chrome] Puppeteer Chrome OK: ${existing}`);
  process.exit(0);
}

console.log("[setup:chrome] Downloading Puppeteer Chrome (one-time, ~150MB)…");
const cli = path.join(root, "node_modules", "puppeteer", "lib", "cjs", "puppeteer", "node", "cli.js");
const r = spawnSync(process.execPath, [cli, "browsers", "install", "chrome"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, PUPPETEER_SKIP_DOWNLOAD: undefined },
});

if (r.status === 0) {
  const after = bundledChromePath();
  if (after) console.log(`[setup:chrome] Installed: ${after}`);
  process.exit(0);
}

console.warn("[setup:chrome] Download failed — app will try Microsoft Edge or system Chrome at runtime.");
process.exit(0);
