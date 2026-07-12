export async function sendResendEmail(input: {
  to: string | string[];
  subject: string;
  html: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.CONTACT_FROM_EMAIL?.trim() || "WhatsApp AI Desk <onboarding@resend.dev>";
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY not configured" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(input.to) ? input.to : [input.to],
      subject: input.subject,
      html: input.html,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `Resend HTTP ${res.status}: ${text.slice(0, 200)}` };
  }
  return { ok: true };
}

export function licensePurchaseEmailHtml(input: {
  licenseKey: string;
  plan: string;
  downloadUrl: string;
}): string {
  return `
    <h2>Welcome to WhatsApp AI Desk</h2>
    <p>Your <strong>${input.plan}</strong> license is ready.</p>
    <p><strong>License key:</strong></p>
    <pre style="font-size:16px;padding:12px;background:#111;color:#6ee7b7;border-radius:8px">${input.licenseKey}</pre>
    <ol>
      <li><a href="${input.downloadUrl}">Download the Windows installer</a></li>
      <li>Install and open the app</li>
      <li>Paste your license key on the unlock screen</li>
      <li>Setup → API keys → add OpenRouter key → Save + Test</li>
      <li>Connect WhatsApp and use Draft queue for safe testing</li>
    </ol>
    <p>Need help? Reply to this email or visit our support page.</p>
  `;
}
