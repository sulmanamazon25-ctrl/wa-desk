import { spawn } from "node:child_process";
import { copyFile, mkdir } from "node:fs/promises";
import { readdir } from "node:fs/promises";
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
const deskBuildEnv = {
  DESK_LICENSE_SERVER_URL: process.env.DESK_LICENSE_SERVER_URL || "",
  DESK_MARKETING_ORIGIN: process.env.DESK_MARKETING_ORIGIN || "",
  DESK_UPDATE_URL: process.env.DESK_UPDATE_URL || "https://example.com/release/",
  CSC_IDENTITY_AUTO_DISCOVERY: process.env.CSC_IDENTITY_AUTO_DISCOVERY || "false",
};
await run("npm", ["run", "build"], deskBuildEnv);

console.log("2/4 prepare standalone bundle…");
await run("node", ["scripts/prepare-standalone.mjs"]);

console.log("3/4 electron-builder (Windows NSIS)…");
await run("npx", ["electron-builder", "--win", "nsis"], deskBuildEnv);

console.log("4/4 copy installer to public/release for frontend /download…");
const releaseDir = path.join(root, "release");
const publicRelease = path.join(root, "public", "release");
await mkdir(publicRelease, { recursive: true });
const installers = (await readdir(releaseDir)).filter((f) => f.endsWith(".exe"));
if (!installers.length) {
  throw new Error("No .exe found in release/");
}
installers.sort();
const latest = installers[installers.length - 1];
await copyFile(path.join(releaseDir, latest), path.join(publicRelease, "WhatsApp-AI-Desk-Setup-latest.exe"));
console.log(`Copied ${latest} → public/release/WhatsApp-AI-Desk-Setup-latest.exe`);
console.log("Done — installer in release/ and public/release/");
