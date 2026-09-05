/**
 * Çeviri motorunun saf (client-safe) katmanı:
 * içerik tipleri, anahtar şeması, sistem metin sözlüğü,
 * placeholder/HTML koruması ve kalite kontrolleri.
 */

export const CONTENT_TYPES = [
  "product",
  "variant",
  "category",
  "collection",
  "brand",
  "page",
  "blog",
  "menu",
  "theme",
  "system",
  "email",
  "seo",
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  product: "Ürünler",
  variant: "Varyantlar",
  category: "Kategoriler",
  collection: "Koleksiyonlar",
  brand: "Markalar",
  page: "Sayfalar",
  blog: "Blog",
  menu: "Menüler",
  theme: "Tema",
  system: "Sistem metinleri",
  email: "E-posta şablonları",
  seo: "SEO alanları",
};

export const TRANSLATION_STATUSES = [
  "missing",
  "machine",
  "needs_review",
  "translated",
  "approved",
] as const;

export type TranslationStatus = (typeof TRANSLATION_STATUSES)[number];

export const STATUS_LABELS: Record<TranslationStatus, string> = {
  missing: "Eksik",
  machine: "Makine çevirisi",
  needs_review: "İnceleme bekliyor",
  translated: "Çevrildi",
  approved: "Onaylandı",
};

export const BRAND_VOICES = ["professional", "friendly", "luxury", "minimal", "technical"] as const;
export type BrandVoice = (typeof BRAND_VOICES)[number];

export const BRAND_VOICE_LABELS: Record<BrandVoice, string> = {
  professional: "Profesyonel",
  friendly: "Samimi",
  luxury: "Lüks",
  minimal: "Minimal",
  technical: "Teknik",
};

export const SWITCHER_STYLES = ["dropdown", "flags", "text", "flags_text", "minimal", "select"] as const;
export type SwitcherStyle = (typeof SWITCHER_STYLES)[number];

export const SWITCHER_STYLE_LABELS: Record<SwitcherStyle, string> = {
  dropdown: "Açılır liste",
  flags: "Bayraklar",
  text: "Metin",
  flags_text: "Bayrak + metin",
  minimal: "Minimal",
  select: "Mobil seçim",
};

/** Anahtar şeması: `<contentType>.<sahip>.<alan>` */
export function makeKey(contentType: ContentType, owner: string, field: string): string {
  return `${contentType}.${owner}.${field}`;
}

/** Vitrindeki sistem metinleri — hiçbiri bileşende sabit yazılmaz. */
export const SYSTEM_STRINGS: Record<string, string> = {
  "common.search": "Ara",
  "common.login": "Giriş yap",
  "common.register": "Kayıt ol",
  "common.logout": "Çıkış",
  "common.forgot_password": "Şifremi unuttum",
  "common.add_to_cart": "Sepete ekle",
  "common.buy_now": "Hemen al",
  "common.wishlist": "Favoriler",
  "common.compare": "Karşılaştır",
  "common.continue_shopping": "Alışverişe devam et",
  "common.remove": "Kaldır",
  "common.quantity": "Adet",
  "common.in_stock": "Stokta",
  "common.out_of_stock": "Tükendi",
  "common.categories": "Kategoriler",
  "common.products": "Ürünler",
  "common.home": "Ana sayfa",
  "cart.title": "Sepet",
  "cart.empty": "Sepetiniz boş",
  "cart.subtotal": "Ara toplam",
  "cart.shipping": "Kargo",
  "cart.tax": "Vergi",
  "cart.total": "Toplam",
  "cart.added": "Ürün sepete eklendi.",
  "checkout.title": "Ödeme",
  "checkout.shipping_address": "Teslimat adresi",
  "checkout.payment_method": "Ödeme yöntemi",
  "checkout.order_summary": "Sipariş özeti",
  "checkout.place_order": "Siparişi tamamla",
  "account.title": "Hesabım",
  "account.orders": "Siparişlerim",
  "account.profile": "Profil",
  "account.addresses": "Adresler",
  "account.wishlist": "Favorilerim",
  "product.description": "Ürün açıklaması",
  "product.reviews": "Değerlendirmeler",
  "product.questions": "Sorular",
  "product.related": "Benzer ürünler",
  "form.required": "Bu alan zorunludur.",
  "form.invalid_email": "Geçerli bir e-posta adresi girin.",
  "form.saved": "Kaydedildi.",
  "form.error": "İşlem tamamlanamadı.",
  "error.not_found": "Sayfa bulunamadı",
  "error.not_found_text": "Aradığınız sayfa taşınmış veya kaldırılmış olabilir.",
  "email.order_confirmation.subject": "Siparişiniz alındı",
  "email.shipping_confirmation.subject": "Siparişiniz kargoya verildi",
  "email.password_reset.subject": "Şifre sıfırlama talebi",
  "email.welcome.subject": "Hoş geldiniz",
  "email.refund.subject": "İade işleminiz tamamlandı",
  "email.cancellation.subject": "Siparişiniz iptal edildi",
};

export type TranslatableItem = {
  contentType: ContentType;
  entityId: string | null;
  field: string;
  key: string;
  source: string;
  /** Slug alanları çeviri sonrası URL uyumlu hale getirilir. */
  isSlug?: boolean;
  html?: boolean;
};

const PLACEHOLDER_RE = /\{\{\s*[\w.]+\s*\}\}|\{[\w.]+\}/g;
const TAG_RE = /<\/?[a-zA-Z][^>]*>/g;

export function extractPlaceholders(text: string): string[] {
  return (text.match(PLACEHOLDER_RE) ?? []).map((value) => value.replace(/\s+/g, ""));
}

export function extractTags(text: string): string[] {
  return (text.match(TAG_RE) ?? []).map((value) => value.toLowerCase().replace(/\s+/g, " "));
}

export type QualityIssue =
  | "empty"
  | "missing_placeholder"
  | "broken_html"
  | "identical"
  | "too_long"
  | "unsafe_html";

export const QUALITY_LABELS: Record<QualityIssue, string> = {
  empty: "Boş çeviri",
  missing_placeholder: "Eksik değişken",
  broken_html: "Bozuk HTML",
  identical: "Kaynakla aynı",
  too_long: "Aşırı uzun metin",
  unsafe_html: "Güvensiz HTML",
};

const UNSAFE_RE = /<\s*(script|iframe|object|embed)\b|on[a-z]+\s*=|javascript:/i;

/** Çeviri kalite kontrolü — kaydetmeden önce ve toplu işten sonra çalışır. */
export function checkTranslation(source: string, target: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  if (!target.trim()) return ["empty"];
  if (UNSAFE_RE.test(target)) issues.push("unsafe_html");

  const sourcePlaceholders = new Set(extractPlaceholders(source));
  const targetPlaceholders = new Set(extractPlaceholders(target));
  for (const placeholder of sourcePlaceholders) {
    if (!targetPlaceholders.has(placeholder)) {
      issues.push("missing_placeholder");
      break;
    }
  }

  const sourceTags = extractTags(source);
  const targetTags = extractTags(target);
  if (sourceTags.length !== targetTags.length) issues.push("broken_html");

  if (source.trim() && source.trim() === target.trim()) issues.push("identical");
  if (source.length > 12 && target.length > source.length * 3) issues.push("too_long");
  return issues;
}

/** Basit HTML temizliği: script/iframe ve olay nitelikleri kaldırılır. */
export function sanitizeTranslation(value: string): string {
  return value
    .replace(/<\s*(script|iframe|object|embed)[\s\S]*?<\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|iframe|object|embed)[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}

export function slugifyTranslation(value: string): string {
  const map: Record<string, string> = {
    ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u",
    à: "a", á: "a", â: "a", ä: "a", è: "e", é: "e", ê: "e", ë: "e",
    í: "i", î: "i", ó: "o", ô: "o", ú: "u", û: "u", ñ: "n", ß: "ss",
  };
  return value
    .toLowerCase()
    .replace(/[çğıöşüàáâäèéêëíîóôúûñß]/g, (char) => map[char] ?? char)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

export type LocaleProgress = {
  locale: string;
  total: number;
  translated: number;
  machine: number;
  review: number;
  missing: number;
  percent: number;
  updatedAt: string | null;
};

export function computeProgress(
  rows: { locale: string; status: string; updated_at: string }[],
  locales: readonly string[],
): LocaleProgress[] {
  return locales.map((locale) => {
    const own = rows.filter((row) => row.locale === locale);
    const translated = own.filter((row) => row.status === "translated" || row.status === "approved").length;
    const machine = own.filter((row) => row.status === "machine").length;
    const review = own.filter((row) => row.status === "needs_review").length;
    const missing = own.filter((row) => row.status === "missing").length;
    const total = own.length;
    const updatedAt = own.reduce<string | null>(
      (latest, row) => (!latest || row.updated_at > latest ? row.updated_at : latest),
      null,
    );
    return {
      locale,
      total,
      translated,
      machine,
      review,
      missing,
      percent: total === 0 ? 0 : Math.round(((translated + machine) / total) * 100),
      updatedAt,
    };
  });
}

/** Çeviri hafızası için kararlı anahtar (kriptografik olmayan hash). */
export function sourceHash(text: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    h1 = ((h1 ^ code) * 0x01000193) >>> 0;
    h2 = ((h2 + code * 31) ^ (h2 << 5)) >>> 0;
  }
  return `${h1.toString(36)}${h2.toString(36)}`;
}

/** CSV dışa aktarım (key, locale, source, value, status). */
export function toCsv(
  rows: { translation_key: string; locale: string; source_value: string | null; translated_value: string | null; status: string }[],
): string {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = ["key,locale,source,value,status"];
  for (const row of rows) {
    lines.push(
      [row.translation_key, row.locale, row.source_value ?? "", row.translated_value ?? "", row.status]
        .map(escape)
        .join(","),
    );
  }
  return lines.join("\n");
}
