import { cp, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const standaloneSrc = path.join(root, ".next", "standalone");
const staticSrc = path.join(root, ".next", "static");
const publicSrc = path.join(root, "public");
const out = path.join(root, "resources", "standalone");

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(path.join(standaloneSrc, "server.js")))) {
  console.error("Missing .next/standalone/server.js — run `next build` first.");
  process.exit(1);
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(standaloneSrc, out, { recursive: true });

const staticDest = path.join(out, ".next", "static");
await mkdir(path.dirname(staticDest), { recursive: true });
if (await exists(staticSrc)) {
  await cp(staticSrc, staticDest, { recursive: true });
}

if (await exists(publicSrc)) {
  await cp(publicSrc, path.join(out, "public"), { recursive: true });
}

console.log("Prepared resources/standalone for electron-builder.");
