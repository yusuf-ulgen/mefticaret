/**
 * ISO dil / locale kataloğu ve yardımcıları.
 * Liste bileşenlerde sabit yazılmaz; mağaza dilleri veritabanında tutulur,
 * bu katalog yalnızca dil eklerken öneri ve doğrulama amaçlıdır.
 */

export type LanguageDef = {
  code: string; // ISO 639-1
  locale: string; // BCP 47
  label: string; // Türkçe ad
  native: string; // Yerel ad
  dir: "ltr" | "rtl";
  flag: string;
  currency?: string;
};

export const LANGUAGE_CATALOG: LanguageDef[] = [
  { code: "tr", locale: "tr-TR", label: "Türkçe", native: "Türkçe", dir: "ltr", flag: "🇹🇷", currency: "TRY" },
  { code: "en", locale: "en-US", label: "İngilizce", native: "English", dir: "ltr", flag: "🇺🇸", currency: "USD" },
  { code: "en", locale: "en-GB", label: "İngilizce (UK)", native: "English (UK)", dir: "ltr", flag: "🇬🇧", currency: "GBP" },
  { code: "de", locale: "de-DE", label: "Almanca", native: "Deutsch", dir: "ltr", flag: "🇩🇪", currency: "EUR" },
  { code: "fr", locale: "fr-FR", label: "Fransızca", native: "Français", dir: "ltr", flag: "🇫🇷", currency: "EUR" },
  { code: "fr", locale: "fr-CA", label: "Fransızca (Kanada)", native: "Français (Canada)", dir: "ltr", flag: "🇨🇦", currency: "CAD" },
  { code: "es", locale: "es-ES", label: "İspanyolca", native: "Español", dir: "ltr", flag: "🇪🇸", currency: "EUR" },
  { code: "it", locale: "it-IT", label: "İtalyanca", native: "Italiano", dir: "ltr", flag: "🇮🇹", currency: "EUR" },
  { code: "ar", locale: "ar-SA", label: "Arapça", native: "العربية", dir: "rtl", flag: "🇸🇦", currency: "SAR" },
  { code: "ar", locale: "ar-AE", label: "Arapça (BAE)", native: "العربية (الإمارات)", dir: "rtl", flag: "🇦🇪", currency: "AED" },
  { code: "fa", locale: "fa-IR", label: "Farsça", native: "فارسی", dir: "rtl", flag: "🇮🇷" },
  { code: "he", locale: "he-IL", label: "İbranice", native: "עברית", dir: "rtl", flag: "🇮🇱" },
  { code: "ru", locale: "ru-RU", label: "Rusça", native: "Русский", dir: "ltr", flag: "🇷🇺", currency: "RUB" },
  { code: "uk", locale: "uk-UA", label: "Ukraynaca", native: "Українська", dir: "ltr", flag: "🇺🇦" },
  { code: "nl", locale: "nl-NL", label: "Hollandaca", native: "Nederlands", dir: "ltr", flag: "🇳🇱", currency: "EUR" },
  { code: "pt", locale: "pt-PT", label: "Portekizce", native: "Português", dir: "ltr", flag: "🇵🇹", currency: "EUR" },
  { code: "pt", locale: "pt-BR", label: "Portekizce (Brezilya)", native: "Português (Brasil)", dir: "ltr", flag: "🇧🇷", currency: "BRL" },
  { code: "pl", locale: "pl-PL", label: "Lehçe", native: "Polski", dir: "ltr", flag: "🇵🇱", currency: "PLN" },
  { code: "ro", locale: "ro-RO", label: "Romence", native: "Română", dir: "ltr", flag: "🇷🇴", currency: "RON" },
  { code: "el", locale: "el-GR", label: "Yunanca", native: "Ελληνικά", dir: "ltr", flag: "🇬🇷", currency: "EUR" },
  { code: "bg", locale: "bg-BG", label: "Bulgarca", native: "Български", dir: "ltr", flag: "🇧🇬" },
  { code: "sv", locale: "sv-SE", label: "İsveççe", native: "Svenska", dir: "ltr", flag: "🇸🇪" },
  { code: "da", locale: "da-DK", label: "Danca", native: "Dansk", dir: "ltr", flag: "🇩🇰" },
  { code: "no", locale: "nb-NO", label: "Norveççe", native: "Norsk", dir: "ltr", flag: "🇳🇴" },
  { code: "fi", locale: "fi-FI", label: "Fince", native: "Suomi", dir: "ltr", flag: "🇫🇮" },
  { code: "cs", locale: "cs-CZ", label: "Çekçe", native: "Čeština", dir: "ltr", flag: "🇨🇿" },
  { code: "hu", locale: "hu-HU", label: "Macarca", native: "Magyar", dir: "ltr", flag: "🇭🇺" },
  { code: "zh", locale: "zh-CN", label: "Çince (Basit)", native: "简体中文", dir: "ltr", flag: "🇨🇳", currency: "CNY" },
  { code: "zh", locale: "zh-TW", label: "Çince (Geleneksel)", native: "繁體中文", dir: "ltr", flag: "🇹🇼" },
  { code: "ja", locale: "ja-JP", label: "Japonca", native: "日本語", dir: "ltr", flag: "🇯🇵", currency: "JPY" },
  { code: "ko", locale: "ko-KR", label: "Korece", native: "한국어", dir: "ltr", flag: "🇰🇷", currency: "KRW" },
  { code: "hi", locale: "hi-IN", label: "Hintçe", native: "हिन्दी", dir: "ltr", flag: "🇮🇳", currency: "INR" },
  { code: "id", locale: "id-ID", label: "Endonezyaca", native: "Bahasa Indonesia", dir: "ltr", flag: "🇮🇩" },
  { code: "ms", locale: "ms-MY", label: "Malayca", native: "Bahasa Melayu", dir: "ltr", flag: "🇲🇾" },
  { code: "th", locale: "th-TH", label: "Tayca", native: "ไทย", dir: "ltr", flag: "🇹🇭" },
  { code: "vi", locale: "vi-VN", label: "Vietnamca", native: "Tiếng Việt", dir: "ltr", flag: "🇻🇳" },
  { code: "az", locale: "az-AZ", label: "Azerbaycanca", native: "Azərbaycanca", dir: "ltr", flag: "🇦🇿" },
  { code: "sq", locale: "sq-AL", label: "Arnavutça", native: "Shqip", dir: "ltr", flag: "🇦🇱" },
  { code: "sr", locale: "sr-RS", label: "Sırpça", native: "Српски", dir: "ltr", flag: "🇷🇸" },
  { code: "hr", locale: "hr-HR", label: "Hırvatça", native: "Hrvatski", dir: "ltr", flag: "🇭🇷" },
  { code: "ur", locale: "ur-PK", label: "Urduca", native: "اردو", dir: "rtl", flag: "🇵🇰" },
];

const RTL_CODES = new Set(["ar", "fa", "he", "ur", "ps", "sd", "yi", "dv", "ku"]);

export function isRtlLanguage(codeOrLocale: string): boolean {
  return RTL_CODES.has(codeOrLocale.slice(0, 2).toLowerCase());
}

export function localeShortCode(locale: string): string {
  return locale.slice(0, 2).toLowerCase();
}

/** Locale biçimini doğrular: `tr`, `tr-TR`, `zh-Hant-TW`. */
export function isValidLocale(value: string): boolean {
  return /^[a-z]{2,3}(-[A-Za-z0-9]{2,8}){0,2}$/.test(value);
}

export function findLanguage(locale: string): LanguageDef | undefined {
  const exact = LANGUAGE_CATALOG.find((entry) => entry.locale.toLowerCase() === locale.toLowerCase());
  if (exact) return exact;
  return LANGUAGE_CATALOG.find((entry) => entry.code === localeShortCode(locale));
}

export function languageFlag(locale: string): string {
  return findLanguage(locale)?.flag ?? "🌐";
}

export function languageNative(locale: string): string {
  return findLanguage(locale)?.native ?? locale;
}

/**
 * Tarayıcı dilini mağazanın aktif dillerine eşler.
 * Tam locale eşleşmesi > kısa kod eşleşmesi > varsayılan dil.
 */
export function matchBrowserLocale(
  browserLocales: readonly string[],
  available: readonly string[],
  fallback: string,
): string {
  const lowered = available.map((value) => value.toLowerCase());
  for (const candidate of browserLocales) {
    const index = lowered.indexOf(candidate.toLowerCase());
    if (index >= 0) return available[index]!;
  }
  for (const candidate of browserLocales) {
    const short = localeShortCode(candidate);
    const index = lowered.findIndex((value) => localeShortCode(value) === short);
    if (index >= 0) return available[index]!;
  }
  return fallback;
}

/**
 * Yedek dil zinciri: fr-CA → fr-FR → varsayılan dil.
 * Zincir mağaza ayarındaki `fallback_chain` ile genişletilebilir.
 */
export function buildFallbackChain(
  locale: string,
  available: readonly string[],
  defaultLocale: string,
  extra: readonly string[] = [],
): string[] {
  const chain: string[] = [locale];
  const short = localeShortCode(locale);
  for (const candidate of available) {
    if (candidate !== locale && localeShortCode(candidate) === short) chain.push(candidate);
  }
  for (const candidate of extra) {
    if (!chain.includes(candidate)) chain.push(candidate);
  }
  if (!chain.includes(defaultLocale)) chain.push(defaultLocale);
  return chain;
}

/** Locale'e göre sayı biçimi. */
export function formatNumberFor(locale: string, value: number): string {
  try {
    return new Intl.NumberFormat(locale).format(value);
  } catch {
    return String(value);
  }
}

/** Locale'e göre para biçimi (para birimi dil sisteminden bağımsız yönetilir). */
export function formatMoneyFor(locale: string, value: number, currency: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

export function formatDateFor(locale: string, value: string | Date): string {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
      typeof value === "string" ? new Date(value) : value,
    );
  } catch {
    return String(value);
  }
}
