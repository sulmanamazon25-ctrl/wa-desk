"use client";

import Image from "next/image";
import Link from "next/link";

import { CrispChat } from "@/components/marketing/CrispChat";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { BRAND, FOUNDER, brandCopyright } from "@/lib/brand";
import { useMarketingLocale } from "@/i18n/marketing/MarketingLocaleContext";

export function MarketingShell({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: "home" | "pricing" | "contact" | "download" | "support" | "how-it-works";
}) {
  const { dict, lp } = useMarketingLocale();

  return (
    <div className="min-h-screen bg-[#05070a] text-zinc-100">
      <CrispChat />
      <MarketingNav active={active} />
      {children}
      <footer className="border-t border-white/[0.06] px-4 py-8 text-center text-xs text-zinc-500">
        <div className="mb-6 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Image
            src={FOUNDER.imagePath}
            alt={FOUNDER.name}
            width={56}
            height={56}
            className="rounded-full border border-emerald-500/40 object-cover"
          />
          <div className="text-center sm:text-left">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-400">
              Founder
            </p>
            <p className="text-sm font-semibold text-zinc-200">{FOUNDER.name}</p>
            <p className="mt-0.5 max-w-sm text-[12px] leading-relaxed text-zinc-500">
              Founder of {BRAND.name}. Builds software, AI products, and digital businesses.
            </p>
            <a
              href={FOUNDER.portfolioUrl}
              className="mt-1 inline-block text-[12px] font-medium text-emerald-400 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              msulemanhussain.com
            </a>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href={lp("/for/small-business")} className="hover:text-zinc-300">
            {dict.footer.forSmallBusiness}
          </Link>
          <Link href={lp("/vs/wati")} className="hover:text-zinc-300">
            {dict.footer.vsWati}
          </Link>
          <Link href={lp("/vs/respond-io")} className="hover:text-zinc-300">
            {dict.footer.vsRespondIo}
          </Link>
          <Link href={lp("/vs/interakt")} className="hover:text-zinc-300">
            {dict.footer.vsInterakt}
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-4">
          <Link href={lp("/terms")} className="hover:text-zinc-300">
            {dict.footer.terms}
          </Link>
          <Link href={lp("/privacy")} className="hover:text-zinc-300">
            {dict.footer.privacy}
          </Link>
          <Link href={lp("/acceptable-use")} className="hover:text-zinc-300">
            {dict.footer.acceptableUse}
          </Link>
        </div>
        <p className="mt-3">{brandCopyright()}</p>
      </footer>
    </div>
  );
}
