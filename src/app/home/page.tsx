"use client";

import * as React from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/I18nContext";

export default function HomeHubPage() {
  const { t } = useI18n();
  const [status, setStatus] = React.useState<"loading" | "ready">("loading");

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.desktop?.gate) {
      setStatus("ready");
      return;
    }
    void window.desktop.gate.status().then(() => setStatus("ready"));
  }, []);

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-[#05080c] px-4 py-12 text-zinc-100"
      id="main-content"
    >
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.12),transparent)]" />
      <div className="relative w-full max-w-lg desk-card border border-white/[0.08] bg-white/[0.03] p-8 shadow-2xl backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-base font-black text-black shadow-lg shadow-emerald-500/25"
            aria-hidden
          >
            W
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">{t("home.heading")}</h1>
            <p className="text-sm text-zinc-500">{t("app.sub")}</p>
          </div>
        </div>
        <p className="mt-5 text-sm leading-relaxed text-zinc-400">{t("home.lead")}</p>

        {status === "loading" ? (
          <div className="mt-8 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-emerald-400" aria-hidden />
            <span className="sr-only">{t("home.loading")}</span>
          </div>
        ) : (
          <div className="mt-8 flex justify-center">
            <Link
              href="/dashboard"
              className="inline-flex w-full max-w-xs items-center justify-center rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 px-5 py-3.5 text-sm font-semibold text-black shadow-lg shadow-emerald-500/20"
            >
              {t("home.ctaDesk")}
            </Link>
          </div>
        )}

        <div className="mt-8 border-t border-white/[0.06] pt-6">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{t("home.publicLinks")}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Link
              href="/pricing"
              className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-xs font-semibold text-zinc-300 transition hover:border-white/20 hover:text-white"
            >
              {t("nav.pricing")}
            </Link>
            <Link
              href="/contact"
              className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-xs font-semibold text-zinc-300 transition hover:border-white/20 hover:text-white"
            >
              {t("nav.contact")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
