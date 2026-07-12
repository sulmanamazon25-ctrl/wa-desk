import { NextResponse } from "next/server";
import { verifyLicenseToken } from "@/lib/server/license-crypto";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Missing token" }, { status: 401 });
  }
  const v = verifyLicenseToken(auth);
  if (!v.ok) {
    return NextResponse.json({ ok: false, error: v.error }, { status: 403 });
  }
  return NextResponse.json({
    ok: true,
    plan: v.payload.plan,
    email: v.payload.email,
    expiresAt: v.payload.exp ? new Date(v.payload.exp * 1000).toISOString() : null,
  });
}
