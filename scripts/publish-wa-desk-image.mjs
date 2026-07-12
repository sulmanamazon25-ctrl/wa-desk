#!/usr/bin/env node
/** Build wa-desk image and push to GHCR for Coolify paste deploy */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const image = "ghcr.io/sulmanamazon25-ctrl/wa-desk:latest";

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: root, shell: process.platform === "win32", ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log("1/4 Building Docker image (may take several minutes)…");
run("docker", ["build", "-f", "deploy/wa-desk/Dockerfile", "-t", image, "."]);

console.log("\n2/4 Logging into GHCR…");
const token = spawnSync("gh", ["auth", "token"], { encoding: "utf8", cwd: root });
if (token.status !== 0 || !token.stdout?.trim()) {
  console.error("gh auth token failed — run: gh auth login");
  process.exit(1);
}
run("docker", ["login", "ghcr.io", "-u", "sulmanamazon25-ctrl", "--password-stdin"], {
  input: token.stdout.trim(),
});

console.log("\n3/4 Pushing image…");
run("docker", ["push", image]);

console.log("\n4/4 Done.");
console.log(`Image: ${image}`);
console.log("Coolify: paste deploy/wa-desk/docker-compose.coolify-ready.yml + coolify-env-paste.txt → Deploy");
