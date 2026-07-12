"use client";

import type { ReactNode } from "react";

export function AppShell({
  list,
  detail,
}: {
  list: ReactNode;
  detail: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden">
      <section className="w-80 shrink-0 border-r border-white/[0.06] bg-[#0c121c]/80 sm:w-[22rem]">{list}</section>
      <section className="min-w-0 flex-1 bg-gradient-to-b from-surface to-[#06080c]">{detail}</section>
    </div>
  );
}
