#!/usr/bin/env node
/** Quick smoke test for marketing site + API routes after VPS deploy */
const base = (process.argv[2] || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

const pages = [
  "/",
  "/pricing",
  "/download",
  "/contact",
  "/support",
  "/how-it-works",
  "/for/small-business",
  "/vs/wati",
  "/vs/respond-io",
  "/vs/interakt",
  "/terms",
  "/privacy",
  "/acceptable-use",
];
const apis = [
  { path: "/api/license/validate", method: "GET", expect: [401, 403] },
  { path: "/api/stripe/checkout", method: "POST", body: { plan: "pro" }, expect: [200, 503, 500] },
];

let failed = 0;

async function checkPage(path) {
  const url = `${base}${path}`;
  try {
    const res = await fetch(url, { redirect: "follow" });
    const ok = res.status === 200;
    console.log(`${ok ? "✓" : "✗"} ${path} → ${res.status}`);
    if (!ok) failed++;
  } catch (e) {
    console.log(`✗ ${path} → ${e instanceof Error ? e.message : e}`);
    failed++;
  }
}

async function checkApi({ path, method, body, expect }) {
  const url = `${base}${path}`;
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const ok = expect.includes(res.status);
    console.log(`${ok ? "✓" : "✗"} ${method} ${path} → ${res.status}`);
    if (!ok) failed++;
  } catch (e) {
    console.log(`✗ ${method} ${path} → ${e instanceof Error ? e.message : e}`);
    failed++;
  }
}

console.log(`Smoke test: ${base}\n`);
for (const p of pages) await checkPage(p);
for (const a of apis) await checkApi(a);

console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
