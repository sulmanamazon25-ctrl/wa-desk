import { NextResponse } from "next/server";
import { activateLicenseMachineAsync, findLicenseByKeyAsync } from "@/lib/server/license-db";
import { hashLicenseKey, signLicenseToken } from "@/lib/server/license-crypto";
import type { LicenseActivateRequest, LicenseActivateResponse } from "../../../../../shared/license";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.LICENSE_SIGNING_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ ok: false, error: "License server not configured" } satisfies LicenseActivateResponse, {
      status: 503,
    });
  }

  let body: LicenseActivateRequest;
  try {
    body = (await req.json()) as LicenseActivateRequest;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" } satisfies LicenseActivateResponse, { status: 400 });
  }

  const licenseKey = body.licenseKey?.trim();
  const machineId = body.machineId?.trim();
  if (!licenseKey || !machineId) {
    return NextResponse.json({ ok: false, error: "licenseKey and machineId required" } satisfies LicenseActivateResponse, {
      status: 400,
    });
  }

  const row = await findLicenseByKeyAsync(licenseKey);
  if (!row || row.status !== "active") {
    return NextResponse.json({ ok: false, error: "Invalid or inactive license key" } satisfies LicenseActivateResponse, {
      status: 403,
    });
  }

  if (row.expires_at && Date.now() > new Date(row.expires_at).getTime()) {
    return NextResponse.json({ ok: false, error: "License expired — renew your subscription" } satisfies LicenseActivateResponse, {
      status: 403,
    });
  }

  if (row.machine_id && row.machine_id !== machineId) {
    return NextResponse.json(
      { ok: false, error: "License already activated on another device. Contact support to transfer." } satisfies LicenseActivateResponse,
      { status: 403 },
    );
  }

  const keyHash = hashLicenseKey(licenseKey);
  await activateLicenseMachineAsync(keyHash, machineId);

  const exp = row.expires_at ? Math.floor(new Date(row.expires_at).getTime() / 1000) : null;
  const token = signLicenseToken({
    sub: keyHash,
    email: row.email,
    plan: row.plan,
    machineId,
    exp,
  });

  return NextResponse.json({
    ok: true,
    token,
    plan: row.plan,
    email: row.email,
    expiresAt: row.expires_at,
  } satisfies LicenseActivateResponse);
}
