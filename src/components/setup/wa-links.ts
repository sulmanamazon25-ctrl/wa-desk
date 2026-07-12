/** Must stay in sync with `electron/shell-links.ts` allowlist prefixes. */
export const WA_HELP_LINKS = {
  web: "https://web.whatsapp.com/",
  linkDeviceFaq: "https://faq.whatsapp.com/1317564962315844/",
  linkedDevicesFaq: "https://faq.whatsapp.com/android/26000086/",
  cloudApiDocs: "https://developers.facebook.com/docs/whatsapp/cloud-api/overview",
} as const;

export function supportPageUrl(): string {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SUPPORT_URL?.trim()) {
    return process.env.NEXT_PUBLIC_SUPPORT_URL.trim();
  }
  const base =
    process.env.NEXT_PUBLIC_LICENSE_SERVER_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  if (base) return `${base.replace(/\/$/, "")}/support`;
  return "/support";
}
