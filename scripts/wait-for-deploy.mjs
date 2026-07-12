#!/usr/bin/env node
/** Poll VPS until wa-desk responds, then run smoke test */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = (process.argv[2] || "http://194.9.62.143:3025").replace(/\/$/, "");
const maxMin = Number(process.argv[3] || 15);
const intervalMs = 10_000;

async function ping() {
  try {
    const res = await fetch(`${base}/pricing`, { signal: AbortSignal.timeout(8000) });
    return res.status;
  } catch {
    return null;
  }
}

console.log(`Waiting for ${base}/pricing (up to ${maxMin} min)…\n`);
const deadline = Date.now() + maxMin * 60_000;

while (Date.now() < deadline) {
  const status = await ping();
  if (status === 200) {
    console.log(`✓ Server is up (${status})\n`);
    const r = spawnSync(process.execPath, ["scripts/smoke-marketing.mjs", base], {
      stdio: "inherit",
      cwd: root,
    });
    process.exit(r.status ?? 1);
  }
  process.stdout.write(`  …not ready yet (${new Date().toLocaleTimeString()})\n`);
  await new Promise((r) => setTimeout(r, intervalMs));
}

console.error(`\nTimed out. Check Coolify logs and port mapping 3025.`);
process.exit(1);
