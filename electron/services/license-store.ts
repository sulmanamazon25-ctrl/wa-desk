import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { app } from "electron";
import type { LicenseActivateResponse, LicenseStatus, StoredLicense } from "../../shared/license";

function licensePath(): string {
  return path.join(app.getPath("userData"), "license.json");
}

export function getMachineId(): string {
  const raw = `${app.getPath("userData")}|${process.platform}|${app.getName()}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

function licenseServerUrl(): string {
  return (
    process.env.DESK_LICENSE_SERVER_URL?.trim() ||
    process.env.NEXT_PUBLIC_LICENSE_SERVER_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    ""
  ).replace(/\/$/, "");
}

export async function loadStoredLicense(): Promise<StoredLicense | null> {
  try {
    const raw = await fs.readFile(licensePath(), "utf8");
    return JSON.parse(raw) as StoredLicense;
  } catch {
    return null;
  }
}

export async function saveStoredLicense(lic: StoredLicense): Promise<void> {
  await fs.mkdir(path.dirname(licensePath()), { recursive: true });
  await fs.writeFile(licensePath(), JSON.stringify(lic, null, 2), "utf8");
}

export async function clearStoredLicense(): Promise<void> {
  try {
    await fs.unlink(licensePath());
  } catch {
    /* ignore */
  }
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return Date.now() > new Date(expiresAt).getTime();
}

export async function getLicenseStatus(): Promise<LicenseStatus> {
  const stored = await loadStoredLicense();
  if (!stored) return { licensed: false, machineId: getMachineId() };
  if (isExpired(stored.expiresAt)) {
    return { licensed: false, machineId: getMachineId() };
  }
  return {
    licensed: true,
    plan: stored.plan,
    email: stored.email,
    expiresAt: stored.expiresAt,
    machineId: stored.machineId,
  };
}

export async function activateLicenseKey(licenseKey: string): Promise<LicenseActivateResponse> {
  const base = licenseServerUrl();
  if (!base) {
    return { ok: false, error: "License server URL not configured (DESK_LICENSE_SERVER_URL)." };
  }
  const machineId = getMachineId();
  let res: Response;
  try {
    res = await fetch(`${base}/api/license/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ licenseKey: licenseKey.trim(), machineId }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error — check internet and server URL." };
  }
  const data = (await res.json()) as LicenseActivateResponse;
  if (!data.ok) return data;

  await saveStoredLicense({
    token: data.token,
    licenseKey: licenseKey.trim().toUpperCase(),
    plan: data.plan,
    email: data.email,
    expiresAt: data.expiresAt,
    machineId,
    activatedAt: new Date().toISOString(),
  });
  return data;
}

export async function isLicensed(): Promise<boolean> {
  const s = await getLicenseStatus();
  return s.licensed;
}
