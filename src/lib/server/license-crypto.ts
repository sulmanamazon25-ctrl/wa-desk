import { createHmac, randomBytes, timingSafeEqual, createHash } from "node:crypto";
import type { LicensePlan } from "../../../shared/license";

const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateLicenseKey(): string {
  const block = () => {
    let s = "";
    const bytes = randomBytes(4);
    for (let i = 0; i < 4; i++) {
      s += CHARSET[bytes[i]! % CHARSET.length];
    }
    return s;
  };
  return `WADESK-${block()}-${block()}-${block()}`;
}

export function hashLicenseKey(key: string): string {
  return createHash("sha256").update(key.trim().toUpperCase()).digest("hex");
}

export function signLicenseToken(payload: {
  sub: string;
  email: string;
  plan: LicensePlan;
  machineId: string;
  exp: number | null;
}): string {
  const secret = process.env.LICENSE_SIGNING_SECRET?.trim();
  if (!secret) throw new Error("LICENSE_SIGNING_SECRET not configured");
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

export function verifyLicenseToken(token: string): {
  ok: true;
  payload: { sub: string; email: string; plan: LicensePlan; machineId: string; exp: number | null };
} | { ok: false; error: string } {
  const secret = process.env.LICENSE_SIGNING_SECRET?.trim();
  if (!secret) return { ok: false, error: "LICENSE_SIGNING_SECRET not configured" };
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, error: "Invalid token format" };
  const [header, body, sig] = parts;
  const expected = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, error: "Invalid signature" };
  } catch {
    return { ok: false, error: "Invalid signature" };
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      sub: string;
      email: string;
      plan: LicensePlan;
      machineId: string;
      exp: number | null;
    };
    if (payload.exp != null && Date.now() / 1000 > payload.exp) {
      return { ok: false, error: "License expired" };
    }
    return { ok: true, payload };
  } catch {
    return { ok: false, error: "Invalid token payload" };
  }
}

export function planExpiresAt(plan: LicensePlan, from = new Date()): string | null {
  if (plan === "lifetime") return null;
  const d = new Date(from);
  if (plan === "pro" || plan === "trial") d.setMonth(d.getMonth() + 1);
  else if (plan === "business") d.setFullYear(d.getFullYear() + 1);
  return d.toISOString();
}
