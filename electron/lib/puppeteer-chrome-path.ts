import { accessSync } from "node:fs";
import path from "node:path";
import {
  Browser,
  ChromeReleaseChannel,
  computeSystemExecutablePath,
} from "@puppeteer/browsers";

function exists(filePath: string): boolean {
  try {
    accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function envExecutable(): string | undefined {
  const raw =
    process.env.WWEBJS_CHROME_EXECUTABLE?.trim() ||
    process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  if (raw && exists(raw)) return raw;
  return undefined;
}

function puppeteerBundledPath(): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const puppeteer = require("puppeteer") as { executablePath: () => string };
    const p = puppeteer.executablePath();
    return p && exists(p) ? p : undefined;
  } catch {
    return undefined;
  }
}

function systemChromePath(channel: ChromeReleaseChannel): string | undefined {
  try {
    const p = computeSystemExecutablePath({ browser: Browser.CHROME, channel });
    return exists(p) ? p : undefined;
  } catch {
    return undefined;
  }
}

/** Chromium-based browsers work with whatsapp-web.js on Windows when Chrome is missing. */
function windowsEdgePath(): string | undefined {
  if (process.platform !== "win32") return undefined;
  const candidates = [
    path.join(process.env["PROGRAMFILES(X86)"] ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env.PROGRAMFILES ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env.LOCALAPPDATA ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
  ];
  for (const p of candidates) {
    if (p && exists(p)) return p;
  }
  return undefined;
}

const CHANNELS = [
  ChromeReleaseChannel.STABLE,
  ChromeReleaseChannel.BETA,
  ChromeReleaseChannel.DEV,
  ChromeReleaseChannel.CANARY,
];

/**
 * Resolves a Chromium executable for whatsapp-web.js / Puppeteer.
 * Order: env override → Puppeteer bundle → system Chrome → Edge (Win).
 */
export function resolveChromeExecutablePath(): string | undefined {
  return (
    envExecutable() ??
    puppeteerBundledPath() ??
    CHANNELS.map(systemChromePath).find(Boolean) ??
    windowsEdgePath()
  );
}

export function chromeNotFoundMessage(): string {
  return [
    "No Chrome/Chromium found for WhatsApp linking.",
    "Run `npm run setup:chrome` in the project folder (downloads Puppeteer Chrome once),",
    "install Google Chrome, or set WWEBJS_CHROME_EXECUTABLE in .env to your chrome.exe or msedge.exe path.",
  ].join(" ");
}
