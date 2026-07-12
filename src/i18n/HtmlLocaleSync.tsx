"use client";

import * as React from "react";
import { useI18n } from "./I18nContext";
import { localeUi } from "./locale-config";

/** Keeps `<html lang dir>` in sync for accessibility, SEO, and RTL (e.g. Arabic). */
export function HtmlLocaleSync() {
  const { locale } = useI18n();

  React.useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = localeUi[locale].dir;
  }, [locale]);

  return null;
}
