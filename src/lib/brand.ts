export const BRAND = {
  name: "Wasup",
  domain: "wasup.app",
  url: "https://wasup.app",
  tagline: "AI desk for WhatsApp",
  productDescription:
    "Local-first desktop WhatsApp assistant with BYOK and draft-queue approvals.",
} as const;

export const FOUNDER = {
  name: "Suleman Hussain",
  role: "Founder",
  shortBio:
    "Builds software, AI products, and digital businesses. Founder of Wasup.",
  imagePath: "/brand/suleman-hussain.png",
  portfolioUrl: "https://msulemanhussain.com",
  sameAs: [
    "https://msulemanhussain.com",
    "https://msulemanhussain.com/products/wasup",
    "https://www.linkedin.com/in/msulemanhussain/",
    "https://x.com/msulemanhussain",
    "https://github.com/msulemanhussain",
  ],
} as const;

export function brandTitle(page?: string): string {
  if (!page) return `${BRAND.name} · ${BRAND.tagline}`;
  return `${page} · ${BRAND.name}`;
}

export function brandCopyright(year = new Date().getFullYear()): string {
  return `© ${year} ${BRAND.name} · ${BRAND.tagline}`;
}

export function emailFromName(): string {
  return BRAND.name;
}
