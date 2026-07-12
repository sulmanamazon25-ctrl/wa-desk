import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function run(cmd, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: root,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: { ...process.env, ...env },
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

console.log("0/4 stop dev server if running (production build overwrites .next)…");
console.log("1/4 next build (standalone)…");
await run("npm", ["run", "build"]);

console.log("2/4 prepare standalone bundle…");
await run("node", ["scripts/prepare-standalone.mjs"]);

console.log("3/4 electron-builder (Windows NSIS)…");
await run("npx", ["electron-builder", "--win", "nsis"], {
  DESK_UPDATE_URL: process.env.DESK_UPDATE_URL || "https://example.com/release/",
});

console.log("Done — installer in release/");
