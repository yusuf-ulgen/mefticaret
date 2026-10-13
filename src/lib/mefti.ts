/**
 * Mefticaret çekirdek sabitleri ve yardımcıları (framework-agnostik, izomorfik).
 * Modül sınırları: /lib -> shared katman.
 */

export const INDUSTRIES = [
  { value: "moda", label: "Moda & Giyim" },
  { value: "elektronik", label: "Elektronik" },
  { value: "kozmetik", label: "Kozmetik & Kişisel Bakım" },
  { value: "gida", label: "Gıda & İçecek" },
  { value: "mobilya", label: "Mobilya" },
  { value: "dekorasyon", label: "Ev & Dekorasyon" },
  { value: "taki", label: "Takı & Aksesuar" },
  { value: "spor", label: "Spor & Outdoor" },
  { value: "otomotiv", label: "Otomotiv" },
  { value: "dijital", label: "Dijital Ürün" },
  { value: "diger", label: "Diğer" },
] as const;

export const CURRENCIES = ["TRY", "USD", "EUR", "GBP", "AED", "SAR"] as const;
export const LOCALES = [
  { value: "tr", label: "Türkçe" },
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
  { value: "es", label: "Español" },
  { value: "ar", label: "العربية" },
] as const;

export const ONBOARDING_STEPS = [
  { step: 1, title: "Hesap", description: "Hesabın hazır" },
  { step: 2, title: "Mağaza adı", description: "Marka adını belirle" },
  { step: 3, title: "Sektör", description: "Ne satıyorsun?" },
  { step: 4, title: "Tema", description: "Vitrin temasını seç ve yayınla" },
  { step: 5, title: "İlk ürün", description: "Katalogda ilk ürünü yayınla" },
  { step: 6, title: "Ödeme", description: "Ödeme yöntemini etkinleştir" },
  { step: 7, title: "Kargo", description: "Kargo tarifesi tanımla" },
  { step: 8, title: "Domain", description: "Alt alan adı / özel domain" },
  { step: 9, title: "Ayarlar", description: "Para birimi, dil, vergi" },
  { step: 10, title: "Yayınla", description: "Mağazayı yayına al" },
] as const;

export const STORE_ROLE_LABELS: Record<string, string> = {
  owner: "Mağaza Sahibi",
  admin: "Mağaza Yöneticisi",
  manager: "Mağaza Müdürü",
  staff: "Personel",
  marketing: "Pazarlama",
  support: "Destek",
  seo_manager: "SEO Sorumlusu",
  pricing_manager: "Fiyatlandırma Sorumlusu",
  translator: "Çevirmen",
};

export const APP_ROLE_LABELS: Record<string, string> = {
  platform_admin: "Platform Yöneticisi",
  agency: "Ajans",
  seller: "Marketplace Satıcısı",
  customer: "Müşteri",
};

export const STORE_STATUS_LABELS: Record<string, string> = {
  draft: "Taslak",
  active: "Yayında",
  suspended: "Askıda",
  archived: "Arşiv",
};

/** Platform alt alan adı köki: magazaadi.mefticaret.com */
export const SUBDOMAIN_SUFFIX = "mefticaret.com";

/** Özel domainlerin A kaydı ile göstermesi gereken edge IP'si. */
export const PLATFORM_DNS_A = "185.158.133.1";
/** www / alt alan adı bağlamaları için CNAME hedefi. */
export const PLATFORM_DNS_CNAME = `edge.${SUBDOMAIN_SUFFIX}`;
/** DNS sahiplik doğrulaması için TXT kaydı ön eki. */
export const DOMAIN_TXT_PREFIX = "_mefticaret";

export const RESERVED_SUBDOMAINS = new Set([
  "www",
  "api",
  "app",
  "admin",
  "cdn",
  "edge",
  "mail",
  "smtp",
  "static",
  "assets",
  "status",
  "help",
  "docs",
  "blog",
  "panel",
  "dashboard",
  "checkout",
  "pay",
]);

export const DOMAIN_STATUS_LABELS: Record<string, string> = {
  pending: "DNS bekleniyor",
  verifying: "Doğrulanıyor",
  verified: "Doğrulandı",
  failed: "Doğrulanamadı",
};

export const SSL_STATUS_LABELS: Record<string, string> = {
  pending: "SSL bekliyor",
  provisioning: "Sertifika hazırlanıyor",
  active: "SSL aktif",
  failed: "SSL hatası",
};

/** Hostname'i normalize eder: protokol, yol ve baştaki nokta temizlenir. */
export function normalizeHostname(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^\.+|\.+$/g, "");
}

export function isPlatformSubdomain(hostname: string): boolean {
  return hostname.endsWith(`.${SUBDOMAIN_SUFFIX}`) || hostname === SUBDOMAIN_SUFFIX;
}

/** Kök domain mi (www.x.com değil, x.com) */
export function isApexDomain(hostname: string): boolean {
  return hostname.split(".").length === 2;
}

export function slugify(value: string): string {
  const map: Record<string, string> = {
    ç: "c",
    ğ: "g",
    ı: "i",
    İ: "i",
    ö: "o",
    ş: "s",
    ü: "u",
    Ç: "c",
    Ğ: "g",
    Ö: "o",
    Ş: "s",
    Ü: "u",
  };
  return value
    .split("")
    .map((char) => map[char] ?? char)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

const CURRENCY_ALIASES: Record<string, string> = {
  TL: "TRY",
  YTL: "TRY",
  "₺": "TRY",
  $: "USD",
  "€": "EUR",
  "£": "GBP",
};

export function formatMoney(value: number, currency = "TRY", locale = "tr-TR"): string {
  const raw = String(currency || "TRY")
    .trim()
    .toUpperCase();
  const code = CURRENCY_ALIASES[raw] ?? raw;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)} ${raw}`;
  }
}

export function formatNumber(value: number, locale = "tr-TR"): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(2).replace(".", ",")}%`;
}

export function planLimitLabel(value: number | undefined): string {
  if (value === undefined || value === null) return "—";
  return value < 0 ? "Sınırsız" : formatNumber(value);
}

/** undefined alanları temizler; kısmi güncellemelerde null yazmayı engeller. */
export function compact<T extends Record<string, unknown>>(input: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Beklemede",
  awaiting_payment: "Ödeme bekleniyor",
  paid: "Ödendi",
  processing: "Hazırlanıyor",
  packed: "Paketlendi",
  shipped: "Kargoya verildi",
  delivered: "Teslim edildi",
  cancelled: "İptal edildi",
  returned: "İade edildi",
  refunded: "Geri ödeme yapıldı",
};

/** Sipariş yaşam döngüsü sırası — zaman çizelgesi ve ilerleme göstergesi için. */
export const ORDER_STATUS_FLOW = [
  "pending",
  "awaiting_payment",
  "paid",
  "processing",
  "packed",
  "shipped",
  "delivered",
] as const;

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Ödeme bekliyor",
  paid: "Ödendi",
  partially_refunded: "Kısmi iade",
  refunded: "İade edildi",
  failed: "Başarısız",
};

export const FULFILLMENT_STATUS_LABELS: Record<string, string> = {
  unfulfilled: "Hazırlanmadı",
  partially_fulfilled: "Kısmi gönderildi",
  fulfilled: "Gönderildi",
  returned: "Geri döndü",
};

export const DISCOUNT_TYPE_LABELS: Record<string, string> = {
  percentage: "Yüzde indirim",
  fixed_amount: "Sabit tutar",
  free_shipping: "Ücretsiz kargo",
};

export const SHIPPING_CARRIERS = [
  "Yurtiçi Kargo",
  "MNG Kargo",
  "Aras Kargo",
  "PTT Kargo",
  "Sürat Kargo",
  "UPS",
  "DHL",
] as const;

export function formatDateTime(
  value: string | null | undefined,
  locale = "tr-TR",
  timeZone = "Europe/Istanbul",
): string {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(date);
}

export function formatDate(
  value: string | null | undefined,
  locale = "tr-TR",
  timeZone = "Europe/Istanbul",
): string {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone }).format(date);
}
