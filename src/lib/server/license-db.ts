import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import type { LicensePlan } from "../../../shared/license";
import { generateLicenseKey, hashLicenseKey } from "./license-crypto";
import * as pg from "./license-db-pg";

export type LicenseRow = {
  id: number;
  key_hash: string;
  key_display: string;
  email: string;
  plan: LicensePlan;
  stripe_session_id: string | null;
  status: string;
  machine_id: string | null;
  expires_at: string | null;
  created_at: string;
};

type StoreFile = { nextId: number; rows: LicenseRow[] };

function hasPostgresDb(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function storePath(): string {
  const dataDir = process.env.LICENSE_DB_DIR?.trim() || path.join(process.cwd(), "data");
  mkdirSync(dataDir, { recursive: true });
  return path.join(dataDir, "licenses.json");
}

function readStore(): StoreFile {
  const file = storePath();
  if (!existsSync(file)) return { nextId: 1, rows: [] };
  try {
    return JSON.parse(readFileSync(file, "utf8")) as StoreFile;
  } catch {
    return { nextId: 1, rows: [] };
  }
}

function writeStore(store: StoreFile): void {
  writeFileSync(storePath(), JSON.stringify(store, null, 2), "utf8");
}

export function createLicenseRecord(input: {
  email: string;
  plan: LicensePlan;
  stripeSessionId?: string;
  expiresAt?: string | null;
}): { key: string; row: LicenseRow } {
  if (hasPostgresDb()) {
    // sync wrapper — callers in route handlers are async; migrate callers to async
    throw new Error("Use createLicenseRecordAsync when DATABASE_URL is set");
  }
  const key = generateLicenseKey();
  const keyHash = hashLicenseKey(key);
  const store = readStore();
  const row: LicenseRow = {
    id: store.nextId++,
    key_hash: keyHash,
    key_display: key,
    email: input.email,
    plan: input.plan,
    stripe_session_id: input.stripeSessionId ?? null,
    status: "active",
    machine_id: null,
    expires_at: input.expiresAt ?? null,
    created_at: new Date().toISOString(),
  };
  store.rows.push(row);
  writeStore(store);
  return { key, row };
}

export async function createLicenseRecordAsync(input: {
  email: string;
  plan: LicensePlan;
  stripeSessionId?: string;
  expiresAt?: string | null;
}): Promise<{ key: string; row: LicenseRow }> {
  if (hasPostgresDb()) return pg.createLicenseRecordPg(input);
  return createLicenseRecord(input);
}

export function findLicenseByKey(licenseKey: string): LicenseRow | null {
  if (hasPostgresDb()) {
    throw new Error("Use findLicenseByKeyAsync when DATABASE_URL is set");
  }
  const keyHash = hashLicenseKey(licenseKey);
  return readStore().rows.find((r) => r.key_hash === keyHash) ?? null;
}

export async function findLicenseByKeyAsync(licenseKey: string): Promise<LicenseRow | null> {
  if (hasPostgresDb()) return pg.findLicenseByKeyPg(licenseKey);
  return findLicenseByKey(licenseKey);
}

export function activateLicenseMachine(keyHash: string, machineId: string): void {
  if (hasPostgresDb()) {
    throw new Error("Use activateLicenseMachineAsync when DATABASE_URL is set");
  }
  const store = readStore();
  const row = store.rows.find((r) => r.key_hash === keyHash);
  if (row) {
    row.machine_id = machineId;
    writeStore(store);
  }
}

export async function activateLicenseMachineAsync(keyHash: string, machineId: string): Promise<void> {
  if (hasPostgresDb()) return pg.activateLicenseMachinePg(keyHash, machineId);
  activateLicenseMachine(keyHash, machineId);
}

export function revokeLicense(keyHash: string): void {
  if (hasPostgresDb()) {
    throw new Error("Use revokeLicenseAsync when DATABASE_URL is set");
  }
  const store = readStore();
  const row = store.rows.find((r) => r.key_hash === keyHash);
  if (row) {
    row.status = "revoked";
    writeStore(store);
  }
}

export async function listLicensesAsync(limit = 50): Promise<LicenseRow[]> {
  if (hasPostgresDb()) return pg.listLicensesPg(limit);
  const store = readStore();
  return [...store.rows].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
}
