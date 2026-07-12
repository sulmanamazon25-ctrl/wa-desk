import { promises as fs } from "node:fs";
import path from "node:path";
import { app } from "electron";
import {
  defaultDeskAccounts,
  migrateDeskAccountsFromDisk,
  normalizeDeskAccountsState,
  type DeskAccountsState,
} from "../../shared/desk-accounts";

export type { DeskAccountsState } from "../../shared/desk-accounts";

function filePath() {
  return path.join(app.getPath("userData"), "desk-accounts.json");
}

export async function loadDeskAccounts(): Promise<DeskAccountsState> {
  try {
    const raw = await fs.readFile(filePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return migrateDeskAccountsFromDisk(parsed);
  } catch {
    return defaultDeskAccounts();
  }
}

export async function saveDeskAccounts(state: DeskAccountsState): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const next = normalizeDeskAccountsState(state);
    await fs.mkdir(path.dirname(filePath()), { recursive: true });
    await fs.writeFile(filePath(), JSON.stringify(next, null, 2), "utf8");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
