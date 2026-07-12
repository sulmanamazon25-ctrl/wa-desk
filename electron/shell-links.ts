function marketingOrigin(): string | null {
  const raw =
    process.env.DESK_MARKETING_ORIGIN?.trim() ||
    process.env.DESK_LICENSE_SERVER_URL?.trim() ||
    process.env.NEXT_PUBLIC_LICENSE_SERVER_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPPORT_URL?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return u.origin;
  } catch {
    return null;
  }
}

const ALLOWED_PREFIXES = [
  "https://web.whatsapp.com/",
  "https://faq.whatsapp.com/",
  "https://www.whatsapp.com/",
  "https://developers.facebook.com/",
  "https://x.ai/",
  "https://docs.x.ai/",
  "https://console.x.ai/",
  "https://api.x.ai/",
  "https://groq.com/",
  "https://console.groq.com/",
  "https://openrouter.ai/",
];

export function isAllowedExternalUrl(url: string): boolean {
  try {
    if (url.startsWith("mailto:")) {
      return url.length < 4096 && url.includes("@");
    }
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const origin = marketingOrigin();
    if (origin && url.startsWith(origin)) return true;
    return ALLOWED_PREFIXES.some((p) => url.startsWith(p));
  } catch {
    return false;
  }
}

export function deskSupportUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SUPPORT_URL?.trim();
  if (explicit) return explicit;
  const origin = marketingOrigin();
  if (origin) return `${origin}/support`;
  return "https://example.com/support";
}

export const WA_HELP_LINKS = {
  web: "https://web.whatsapp.com/",
  linkDeviceFaq: "https://faq.whatsapp.com/1317564962315844/",
  linkedDevicesFaq: "https://faq.whatsapp.com/android/26000086/",
  cloudApiDocs: "https://developers.facebook.com/docs/whatsapp/cloud-api/overview",
} as const;
