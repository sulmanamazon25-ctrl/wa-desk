import { spawn, type ChildProcess } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { app } from "electron";

let child: ChildProcess | null = null;
let baseUrl = "";

function standaloneDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "standalone");
  }
  return path.join(app.getAppPath(), ".next", "standalone");
}

async function waitForReady(url: string, timeoutMs = 90_000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.get(`${url}/home`, (res) => {
          res.resume();
          if (res.statusCode && res.statusCode < 500) resolve();
          else reject(new Error(`HTTP ${res.statusCode}`));
        });
        req.on("error", reject);
        req.setTimeout(4000, () => {
          req.destroy();
          reject(new Error("timeout"));
        });
      });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw new Error(`Next standalone did not become ready at ${url}`);
}

export function getStandaloneBaseUrl(): string {
  return baseUrl || process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
}

export async function startStandaloneServer(): Promise<string> {
  if (!app.isPackaged) {
    baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
    return baseUrl;
  }

  const dir = standaloneDir();
  const serverJs = path.join(dir, "server.js");
  const port = String(31_337 + Math.floor(Math.random() * 2000));
  baseUrl = `http://127.0.0.1:${port}`;

  const env = {
    ...process.env,
    NODE_ENV: "production",
    PORT: port,
    HOSTNAME: "127.0.0.1",
    NEXT_TELEMETRY_DISABLED: "1",
  };

  child = spawn(process.execPath, [serverJs], {
    cwd: dir,
    env: { ...env, ELECTRON_RUN_AS_NODE: "1" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  child.stdout?.on("data", (d) => {
    if (process.env.WWEBJS_DEV_LOG === "1") console.log("[next]", String(d).trim());
  });
  child.stderr?.on("data", (d) => {
    if (process.env.WWEBJS_DEV_LOG === "1") console.warn("[next]", String(d).trim());
  });

  child.on("exit", (code) => {
    if (code != null && code !== 0) console.error("[desk] Next standalone exited:", code);
    child = null;
  });

  await waitForReady(baseUrl);
  process.env.NEXT_PUBLIC_APP_URL = baseUrl;
  return baseUrl;
}

export function stopStandaloneServer(): void {
  if (child && !child.killed) {
    child.kill();
    child = null;
  }
}
