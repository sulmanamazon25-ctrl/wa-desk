"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

export function DashboardGateClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.desktop?.gate) return;
    void window.desktop.gate.status().then(({ unlocked }) => {
      if (!unlocked && pathname?.startsWith("/dashboard")) {
        router.replace("/gate");
      }
    });
  }, [router, pathname]);

  return <>{children}</>;
}
