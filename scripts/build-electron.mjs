import * as esbuild from "esbuild";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

await mkdir(path.join(root, "dist-electron"), { recursive: true });

const common = {
  bundle: true,
  platform: "node",
  target: "node20",
  sourcemap: true,
  logLevel: "info",
  packages: "external",
};

await esbuild.build({
  ...common,
  entryPoints: [path.join(root, "electron", "main.ts")],
  outfile: path.join(root, "dist-electron", "main.js"),
  format: "cjs",
});

await esbuild.build({
  ...common,
  entryPoints: [path.join(root, "electron", "preload.ts")],
  outfile: path.join(root, "dist-electron", "preload.js"),
  format: "cjs",
});

console.log("Electron bundle complete.");
