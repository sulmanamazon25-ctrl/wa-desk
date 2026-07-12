import { promises as fs } from "node:fs";
import path from "node:path";
import { app } from "electron";

const DEFAULT_TRIAL_HOURS = 72;

type TrialRecord = { startedAt: string };

function trialPath(): string {
  return path.join(app.getPath("userData"), "trial.json");
}

function trialHours(): number {
  const raw = process.env.DESK_TRIAL_HOURS?.trim();
  if (raw === "0") return 0;
  const n = raw ? Number(raw) : DEFAULT_TRIAL_HOURS;
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_TRIAL_HOURS;
}

export async function ensureTrialStarted(): Promise<TrialRecord> {
  try {
    const raw = await fs.readFile(trialPath(), "utf8");
    return JSON.parse(raw) as TrialRecord;
  } catch {
    const rec: TrialRecord = { startedAt: new Date().toISOString() };
    await fs.mkdir(path.dirname(trialPath()), { recursive: true });
    await fs.writeFile(trialPath(), JSON.stringify(rec, null, 2), "utf8");
    return rec;
  }
}

export async function getTrialEndsAt(): Promise<string | null> {
  const hours = trialHours();
  if (hours <= 0) return new Date(0).toISOString();
  const rec = await ensureTrialStarted();
  const end = new Date(rec.startedAt).getTime() + hours * 60 * 60 * 1000;
  return new Date(end).toISOString();
}

export async function isTrialActive(): Promise<boolean> {
  const hours = trialHours();
  if (hours <= 0) return false;
  const rec = await ensureTrialStarted();
  const end = new Date(rec.startedAt).getTime() + hours * 60 * 60 * 1000;
  return Date.now() < end;
}

export async function trialDaysRemaining(): Promise<number> {
  const hours = trialHours();
  if (hours <= 0) return 0;
  const rec = await ensureTrialStarted();
  const end = new Date(rec.startedAt).getTime() + hours * 60 * 60 * 1000;
  const msLeft = end - Date.now();
  if (msLeft <= 0) return 0;
  return Math.ceil(msLeft / (24 * 60 * 60 * 1000));
}
