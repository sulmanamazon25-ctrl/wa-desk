import { app } from "electron";

type AutoUpdater = import("electron-updater").AppUpdater;

function loadAutoUpdater(): AutoUpdater | null {
  try {
    // Lazy require so packaged app resolves from production node_modules.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { autoUpdater } = require("electron-updater") as typeof import("electron-updater");
    return autoUpdater;
  } catch (e) {
    console.warn("[desk] electron-updater unavailable:", e instanceof Error ? e.message : e);
    return null;
  }
}

export function setupAutoUpdater(): void {
  if (!app.isPackaged) return;
  const url = process.env.DESK_UPDATE_URL?.trim();
  if (!url) return;

  const autoUpdater = loadAutoUpdater();
  if (!autoUpdater) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", () => {
    console.log("[desk] Update available — download from", url);
  });

  autoUpdater.on("error", (err) => {
    console.warn("[desk] Auto-updater:", err.message);
  });

  void autoUpdater.checkForUpdates().catch((e) => {
    console.warn("[desk] Update check failed:", e instanceof Error ? e.message : e);
  });
}
