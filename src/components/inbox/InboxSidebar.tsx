"use client";

import Link from "next/link";

export function InboxSidebar({ t }: { t: (key: string) => string }) {
  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{t("nav.inbox")}</div>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">{t("app.sub")}</p>
      </div>
      <div className="mt-auto rounded-xl border border-white/[0.06] bg-black/25 p-3 text-xs text-zinc-500 xl:hidden">
        <Link href="/training" className="font-medium text-emerald-300/90 hover:underline">
          {t("training.mobileLink")}
        </Link>
        <p className="mt-1 text-[11px] leading-relaxed">{t("training.mobileHint")}</p>
      </div>
    </div>
  );
}
