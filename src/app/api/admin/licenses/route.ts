import { NextResponse } from "next/server";
import { adminUnauthorized, verifyAdminAuth } from "@/lib/server/admin-auth";
import { createLicenseRecordAsync, listLicensesAsync } from "@/lib/server/license-db";
import { planExpiresAt } from "@/lib/server/license-crypto";
import type { LicensePlan } from "../../../../../shared/license";

export const runtime = "nodejs";

const PLANS: LicensePlan[] = ["trial", "pro", "business", "lifetime"];

export async function GET(req: Request) {
  if (!verifyAdminAuth(req)) return adminUnauthorized();
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? "50");
  const rows = await listLicensesAsync(limit);
  return NextResponse.json({
    licenses: rows.map((r) => ({
      id: r.id,
      email: r.email,
      plan: r.plan,
      status: r.status,
      machine_id: r.machine_id,
      expires_at: r.expires_at,
      created_at: r.created_at,
      key_hint: r.key_display.slice(0, 12) + "…",
    })),
  });
}

export async function POST(req: Request) {
  if (!verifyAdminAuth(req)) return adminUnauthorized();

  let body: { email?: string; plan?: string; expiresAt?: string | null };
  try {
    body = (await req.json()) as { email?: string; plan?: string; expiresAt?: string | null };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim();
  const plan = (body.plan ?? "lifetime").toLowerCase() as LicensePlan;
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
  if (!PLANS.includes(plan)) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

  const expiresAt = body.expiresAt !== undefined ? body.expiresAt : planExpiresAt(plan);
  const { key, row } = await createLicenseRecordAsync({ email, plan, expiresAt });

  return NextResponse.json({
    ok: true,
    licenseKey: key,
    license: {
      id: row.id,
      email: row.email,
      plan: row.plan,
      expires_at: row.expires_at,
      created_at: row.created_at,
    },
  });
}
