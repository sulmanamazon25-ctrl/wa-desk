"use client";

import * as React from "react";
import type { Locale } from "./locale-config";
import { isLocale, localeFromNavigatorLang } from "./locale-config";
import { messages } from "./messages";

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
};

const I18nContext = React.createContext<Ctx | null>(null);

const STORAGE_KEY = "wa_ai_desk_locale_v1";

function readInitialLocale(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(raw)) return raw;
  } catch {
    /* ignore */
  }
  const fromNav = localeFromNavigatorLang(typeof navigator !== "undefined" ? navigator.language : undefined);
  return fromNav ?? "en";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<Locale>("en");
  const hydrated = React.useRef(false);

  React.useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    setLocaleState(readInitialLocale());
  }, []);

  const setLocale = React.useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const t = React.useCallback(
    (key: string) => {
      return messages[locale][key] ?? messages.en[key] ?? key;
    },
    [locale],
  );

  const value = React.useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = React.useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
