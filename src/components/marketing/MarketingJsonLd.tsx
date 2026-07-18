import type { MarketingLocale } from "@/i18n/marketing/locale-config";
import {
  organizationJsonLd,
  personJsonLd,
  softwareApplicationJsonLd,
  websiteJsonLd,
} from "@/lib/seo/marketing-metadata";

export function MarketingJsonLd({ locale }: { locale: MarketingLocale }) {
  const blocks = [
    personJsonLd(),
    organizationJsonLd(locale),
    websiteJsonLd(locale),
    softwareApplicationJsonLd(locale),
  ];
  return (
    <>
      {blocks.map((data, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
      ))}
    </>
  );
}
