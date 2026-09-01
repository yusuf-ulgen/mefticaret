/** Desteklenen diller ve yazım yönleri. Yeni dil eklemek için buraya ve messages.ts'e ekle. */

export const SUPPORTED_LOCALES = ["tr", "en", "de", "fr", "es", "ar"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "tr";

export type LocaleMeta = {
  value: Locale;
  label: string;
  englishLabel: string;
  dir: "ltr" | "rtl";
  intlLocale: string;
};

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  tr: { value: "tr", label: "Türkçe", englishLabel: "Turkish", dir: "ltr", intlLocale: "tr-TR" },
  en: { value: "en", label: "English", englishLabel: "English", dir: "ltr", intlLocale: "en-US" },
  de: { value: "de", label: "Deutsch", englishLabel: "German", dir: "ltr", intlLocale: "de-DE" },
  fr: { value: "fr", label: "Français", englishLabel: "French", dir: "ltr", intlLocale: "fr-FR" },
  es: { value: "es", label: "Español", englishLabel: "Spanish", dir: "ltr", intlLocale: "es-ES" },
  ar: { value: "ar", label: "العربية", englishLabel: "Arabic", dir: "rtl", intlLocale: "ar-AE" },
};

export const LOCALE_LIST: LocaleMeta[] = SUPPORTED_LOCALES.map((locale) => LOCALE_META[locale]);

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function normalizeLocale(value: unknown, fallback: Locale = DEFAULT_LOCALE): Locale {
  if (isLocale(value)) return value;
  if (typeof value === "string") {
    const short = value.slice(0, 2).toLowerCase();
    if (isLocale(short)) return short;
  }
  return fallback;
}
