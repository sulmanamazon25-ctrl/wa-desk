"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/I18nContext";
import { LOCALES, localeUi, type Locale } from "@/i18n/messages";
import type { MainNavTab } from "@/components/premium/AppHeader";
import { supportPageUrl } from "@/components/setup/wa-links";

const PRIMARY: { id: MainNavTab; labelKey: string }[] = [
  { id: "inbox", labelKey: "nav.inbox" },
  { id: "connect", labelKey: "nav.connect" },
];

const SETUP: { id: MainNavTab; labelKey: string }[] = [
  { id: "keys", labelKey: "nav.keys" },
  { id: "business", labelKey: "nav.business" },
  { id: "cloud", labelKey: "nav.cloud" },
  { id: "training", labelKey: "nav.training" },
];

function NavBtn({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
        active
          ? "bg-white/[0.08] text-white shadow-sm ring-1 ring-white/[0.06]"
          : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? "bg-emerald-400" : "bg-transparent"}`}
        aria-hidden
      />
      <span className="truncate">{label}</span>
    </button>
  );
}

export function DeskSidebar({
  mainNav,
  setMainNav,
}: {
  mainNav: MainNavTab;
  setMainNav: (v: MainNavTab) => void;
}) {
  const { t, locale, setLocale } = useI18n();

  function openSupport() {
    const url = supportPageUrl();
    if (window.desktop?.shell?.openExternal) {
      void window.desktop.shell.openExternal(url);
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <aside
      className="desk-sidebar flex w-[var(--desk-sidebar-width)] shrink-0 flex-col border-r border-white/[0.06] bg-[#080b10]/95 backdrop-blur-md"
      aria-label={t("header.mainNavLabel")}
    >
      <div className="border-b border-white/[0.05] px-4 py-4">
        <Link href="/home" className="flex items-center gap-2.5 rounded-lg outline-none ring-emerald-500/30 focus-visible:ring-2">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 text-xs font-black text-black"
            aria-hidden
          >
            W
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">{t("app.title")}</div>
            <div className="truncate text-[10px] text-zinc-500">{t("app.sub")}</div>
          </div>
        </Link>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
        {PRIMARY.map((n) => (
          <NavBtn
            key={n.id}
            label={t(n.labelKey)}
            active={mainNav === n.id}
            onClick={() => setMainNav(n.id)}
          />
        ))}

        <p className="mb-1 mt-4 px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
          {t("nav.setup")}
        </p>
        {SETUP.map((n) => (
          <NavBtn
            key={n.id}
            label={t(n.labelKey)}
            active={mainNav === n.id}
            onClick={() => setMainNav(n.id)}
          />
        ))}
      </nav>

      <div className="shrink-0 space-y-2 border-t border-white/[0.05] px-3 py-3">
        <div className="flex flex-wrap gap-1">
          <Link
            href="/home"
            className="rounded-md px-2 py-1 text-[11px] font-medium text-zinc-500 transition hover:bg-white/[0.04] hover:text-zinc-300"
          >
            {t("nav.home")}
          </Link>
          <Link
            href="/pricing"
            className="rounded-md px-2 py-1 text-[11px] font-medium text-zinc-500 transition hover:bg-white/[0.04] hover:text-zinc-300"
          >
            {t("nav.pricing")}
          </Link>
          <Link
            href="/contact"
            className="rounded-md px-2 py-1 text-[11px] font-medium text-zinc-500 transition hover:bg-white/[0.04] hover:text-zinc-300"
          >
            {t("nav.contact")}
          </Link>
          <button
            type="button"
            onClick={openSupport}
            className="rounded-md px-2 py-1 text-[11px] font-medium text-zinc-500 transition hover:bg-white/[0.04] hover:text-zinc-300"
          >
            {t("nav.support")}
          </button>
        </div>
        <label className="flex items-center gap-2 px-1 text-[11px] text-zinc-500">
          <span>{t("header.lang")}</span>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            className="min-w-0 flex-1 rounded-md border border-white/[0.08] bg-black/40 px-2 py-1 text-xs text-white outline-none"
          >
            {LOCALES.map((code) => (
              <option key={code} value={code}>
                {localeUi[code].nativeName}
              </option>
            ))}
          </select>
        </label>
      </div>
    </aside>
  );
}
