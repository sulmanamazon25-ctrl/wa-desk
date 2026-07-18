import { BRAND, FOUNDER } from "@/lib/brand";
import { MARKETING_LOCALES, marketingLocaleUi, type MarketingLocale } from "@/i18n/marketing/locale-config";
import { localePath } from "@/i18n/marketing/paths";
import type { Metadata } from "next";

const BASE = BRAND.url.replace(/\/$/, "");

export function marketingPageMetadata(
  locale: MarketingLocale,
  path: string,
  meta: { title: string; description: string },
): Metadata {
  const canonical = `${BASE}${localePath(locale, path)}`;
  const languages: Record<string, string> = {};
  for (const loc of MARKETING_LOCALES) {
    languages[marketingLocaleUi[loc].hreflang] = `${BASE}${localePath(loc, path)}`;
  }
  languages["x-default"] = `${BASE}${localePath("en", path)}`;

  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical,
      languages,
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: canonical,
      siteName: BRAND.name,
      type: "website",
      locale: marketingLocaleUi[locale].ogLocale,
      alternateLocale: MARKETING_LOCALES.filter((l) => l !== locale).map((l) => marketingLocaleUi[l].ogLocale),
      images: [{ url: "/brand/og-image.png", width: 1200, height: 630, alt: BRAND.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
      images: ["/brand/og-image.png"],
    },
  };
}

export function organizationJsonLd(locale: MarketingLocale) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${BASE}/#organization`,
    name: BRAND.name,
    url: `${BASE}/${locale}`,
    logo: `${BASE}/favicon.svg`,
    description: BRAND.productDescription,
    founder: {
      "@type": "Person",
      "@id": "https://msulemanhussain.com/#person",
      name: FOUNDER.name,
      url: FOUNDER.portfolioUrl,
      image: `${BASE}${FOUNDER.imagePath}`,
      sameAs: [...FOUNDER.sameAs],
    },
  };
}

export function personJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": "https://msulemanhussain.com/#person",
    name: FOUNDER.name,
    url: FOUNDER.portfolioUrl,
    image: `${BASE}${FOUNDER.imagePath}`,
    jobTitle: FOUNDER.role,
    description: FOUNDER.shortBio,
    sameAs: [...FOUNDER.sameAs],
    worksFor: { "@id": `${BASE}/#organization` },
  };
}

export function websiteJsonLd(locale: MarketingLocale) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: BRAND.name,
    url: `${BASE}/${locale}`,
    inLanguage: marketingLocaleUi[locale].hreflang,
  };
}

export function faqPageJsonLd(locale: MarketingLocale, faq: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: marketingLocaleUi[locale].hreflang,
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };
}

export function softwareApplicationJsonLd(locale: MarketingLocale) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: BRAND.name,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Windows",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Starter BYOK free tier",
    },
    url: `${BASE}/${locale}/download`,
    inLanguage: marketingLocaleUi[locale].hreflang,
  };
}
