"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";
import { LicenseActivateModal } from "@/components/license/LicenseActivateModal";

export default function GatePage() {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = React.useState(true);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.desktop?.gate) {
      router.replace("/dashboard");
    }
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#05080c] px-4 text-zinc-100" id="main-content">
      <LicenseActivateModal
        open={open}
        onClose={() => {
          setOpen(false);
          router.replace("/dashboard");
        }}
        onActivated={() => router.replace("/dashboard")}
      />
      <p className="mt-6 text-center">
        <Link href="/dashboard" className="text-xs font-semibold text-emerald-400/90 underline-offset-4 hover:underline">
          {t("gate.backToHub")}
        </Link>
      </p>
    </div>
  );
}
