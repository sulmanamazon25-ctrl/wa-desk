export const LOCALES = ["en", "ur", "hi", "ar", "es"] as const;

export type Locale = (typeof LOCALES)[number];

export function isLocale(s: string | null | undefined): s is Locale {
  return !!s && (LOCALES as readonly string[]).includes(s);
}

/** UI label + document text direction */
export const localeUi: Record<Locale, { dir: "ltr" | "rtl"; nativeName: string }> = {
  en: { dir: "ltr", nativeName: "English" },
  ur: { dir: "ltr", nativeName: "اردو (رومن)" },
  hi: { dir: "ltr", nativeName: "हिन्दी" },
  ar: { dir: "rtl", nativeName: "العربية" },
  es: { dir: "ltr", nativeName: "Español" },
};

/** Map navigator.language (e.g. en-US, hi-IN) to app locale */
export function localeFromNavigatorLang(lang: string | undefined): Locale | null {
  if (!lang) return null;
  const lower = lang.toLowerCase();
  if (lower.startsWith("ur")) return "ur";
  if (lower.startsWith("hi")) return "hi";
  if (lower.startsWith("ar")) return "ar";
  if (lower.startsWith("es")) return "es";
  const two = lower.slice(0, 2);
  return isLocale(two) ? two : null;
}
