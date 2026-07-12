import * as esbuild from "esbuild";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

await mkdir(path.join(root, "dist-electron"), { recursive: true });

function deskEnvDefine() {
  const keys = [
    "DESK_LICENSE_SERVER_URL",
    "DESK_MARKETING_ORIGIN",
    "DESK_UPDATE_URL",
    "NEXT_PUBLIC_LICENSE_SERVER_URL",
    "NEXT_PUBLIC_APP_URL",
  ];
  const define = {};
  for (const key of keys) {
    const value = process.env[key]?.trim() || "";
    define[`process.env.${key}`] = JSON.stringify(value);
  }
  return define;
}

const common = {
  bundle: true,
  platform: "node",
  target: "node20",
  sourcemap: true,
  logLevel: "info",
  packages: "external",
  define: deskEnvDefine(),
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
