import { Pool } from "pg";
import type { LicensePlan } from "../../../shared/license";
import { generateLicenseKey, hashLicenseKey } from "./license-crypto";

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

let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL not configured");
  pool = new Pool({ connectionString: url, max: 10 });
  return pool;
}

export async function ensureLicenseSchema(): Promise<void> {
  const p = getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS licenses (
      id SERIAL PRIMARY KEY,
      key_hash TEXT NOT NULL UNIQUE,
      key_display TEXT NOT NULL,
      email TEXT NOT NULL,
      plan TEXT NOT NULL,
      stripe_session_id TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      machine_id TEXT,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_licenses_email ON licenses(email);
  `);
}

function rowFromDb(r: Record<string, unknown>): LicenseRow {
  return {
    id: Number(r.id),
    key_hash: String(r.key_hash),
    key_display: String(r.key_display),
    email: String(r.email),
    plan: String(r.plan) as LicensePlan,
    stripe_session_id: r.stripe_session_id != null ? String(r.stripe_session_id) : null,
    status: String(r.status),
    machine_id: r.machine_id != null ? String(r.machine_id) : null,
    expires_at: r.expires_at != null ? new Date(String(r.expires_at)).toISOString() : null,
    created_at: new Date(String(r.created_at)).toISOString(),
  };
}

export async function createLicenseRecordPg(input: {
  email: string;
  plan: LicensePlan;
  stripeSessionId?: string;
  expiresAt?: string | null;
}): Promise<{ key: string; row: LicenseRow }> {
  await ensureLicenseSchema();
  const key = generateLicenseKey();
  const keyHash = hashLicenseKey(key);
  const res = await getPool().query(
    `INSERT INTO licenses (key_hash, key_display, email, plan, stripe_session_id, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [keyHash, key, input.email, input.plan, input.stripeSessionId ?? null, input.expiresAt ?? null],
  );
  return { key, row: rowFromDb(res.rows[0] as Record<string, unknown>) };
}

export async function findLicenseByKeyPg(licenseKey: string): Promise<LicenseRow | null> {
  await ensureLicenseSchema();
  const keyHash = hashLicenseKey(licenseKey);
  const res = await getPool().query(`SELECT * FROM licenses WHERE key_hash = $1`, [keyHash]);
  if (!res.rows[0]) return null;
  return rowFromDb(res.rows[0] as Record<string, unknown>);
}

export async function activateLicenseMachinePg(keyHash: string, machineId: string): Promise<void> {
  await ensureLicenseSchema();
  await getPool().query(`UPDATE licenses SET machine_id = $1 WHERE key_hash = $2`, [machineId, keyHash]);
}

export async function revokeLicensePg(keyHash: string): Promise<void> {
  await ensureLicenseSchema();
  await getPool().query(`UPDATE licenses SET status = 'revoked' WHERE key_hash = $1`, [keyHash]);
}

export async function listLicensesPg(limit = 50): Promise<LicenseRow[]> {
  await ensureLicenseSchema();
  const res = await getPool().query(
    `SELECT * FROM licenses ORDER BY created_at DESC LIMIT $1`,
    [Math.min(Math.max(limit, 1), 200)],
  );
  return res.rows.map((r) => rowFromDb(r as Record<string, unknown>));
}
