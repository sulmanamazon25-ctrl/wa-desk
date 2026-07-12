"use client";

import type { ReactNode } from "react";
import { I18nProvider } from "@/i18n/I18nContext";
import { HtmlLocaleSync } from "@/i18n/HtmlLocaleSync";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <HtmlLocaleSync />
      {children}
    </I18nProvider>
  );
}
