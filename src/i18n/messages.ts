import type { Locale } from "./locale-config";
import { LOCALES, isLocale, localeFromNavigatorLang, localeUi } from "./locale-config";
import type { MessageDict } from "./types";
import { ar } from "./dictionaries/ar";
import { en } from "./dictionaries/en";
import { es } from "./dictionaries/es";
import { hi } from "./dictionaries/hi";
import { ur } from "./dictionaries/ur";

export const messages: Record<Locale, MessageDict> = {
  en,
  ur,
  hi,
  ar,
  es,
};

export type { Locale } from "./locale-config";
export type { MessageDict } from "./types";
export { LOCALES, isLocale, localeFromNavigatorLang, localeUi };
