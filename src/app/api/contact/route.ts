import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX = { name: 120, email: 254, message: 8000 };

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function POST(req: Request) {
  const inbox = process.env.CONTACT_INBOX_EMAIL?.trim() || process.env.SALES_EMAIL?.trim();
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.CONTACT_FROM_EMAIL?.trim() || "WhatsApp AI Desk <onboarding@resend.dev>";

  if (!inbox || !apiKey) {
    return NextResponse.json({ error: "Contact form not configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const email = typeof o.email === "string" ? o.email.trim() : "";
  const message = typeof o.message === "string" ? o.message.trim() : "";
  const plan = typeof o.plan === "string" ? o.plan.trim() : "";

  if (!name || !email || !message) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (name.length > MAX.name || email.length > MAX.email || message.length > MAX.message) {
    return NextResponse.json({ error: "too_long" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const html = `
    <h2>WhatsApp AI Desk — contact</h2>
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    ${plan ? `<p><strong>Plan:</strong> ${escapeHtml(plan)}</p>` : ""}
    <p><strong>Message:</strong></p>
    <pre style="white-space:pre-wrap;font-family:system-ui,sans-serif">${escapeHtml(message)}</pre>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [inbox],
      reply_to: email,
      subject: `WhatsApp AI Desk — ${name.slice(0, 60)}`,
      html,
    }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: "send_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
