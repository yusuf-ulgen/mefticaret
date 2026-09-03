/** Uygulama mağazası sabitleri: kategoriler, izinler ve fiyatlandırma etiketleri. */

export const APP_CATEGORIES = [
  "seo",
  "marketing",
  "payment",
  "shipping",
  "accounting",
  "crm",
  "analytics",
  "social",
  "email",
  "sms",
  "whatsapp",
  "ai",
  "reviews",
  "loyalty",
  "dropshipping",
  "marketplace",
] as const;

export type AppCategory = (typeof APP_CATEGORIES)[number];

export const APP_CATEGORY_LABELS: Record<AppCategory, string> = {
  seo: "SEO",
  marketing: "Pazarlama",
  payment: "Ödeme",
  shipping: "Kargo",
  accounting: "Muhasebe",
  crm: "CRM",
  analytics: "Analitik",
  social: "Sosyal medya",
  email: "E-posta",
  sms: "SMS",
  whatsapp: "WhatsApp",
  ai: "Yapay zekâ",
  reviews: "Yorum",
  loyalty: "Sadakat",
  dropshipping: "Dropshipping",
  marketplace: "Pazaryeri",
};

export const APP_PRICING_LABELS: Record<string, string> = {
  free: "Ücretsiz",
  monthly: "Aylık",
  one_time: "Tek seferlik",
  usage: "Kullanım bazlı",
};

export const APP_INSTALL_STATUS_LABELS: Record<string, string> = {
  installed: "Kurulu",
  paused: "Duraklatıldı",
  uninstalled: "Kaldırıldı",
};

export const APP_PERMISSION_LABELS: Record<string, string> = {
  read_products: "Ürünleri oku",
  write_products: "Ürünleri düzenle",
  read_orders: "Siparişleri oku",
  write_orders: "Siparişleri düzenle",
  read_customers: "Müşterileri oku",
  write_customers: "Müşterileri düzenle",
  read_inventory: "Stokları oku",
  write_inventory: "Stokları düzenle",
  read_store: "Mağaza bilgilerini oku",
  write_store: "Mağaza ayarlarını düzenle",
  read_shipping: "Kargo bilgilerini oku",
  write_shipping: "Kargo bilgilerini düzenle",
  read_payments: "Ödeme bilgilerini oku",
};

export type AppSettingField = {
  key: string;
  label: string;
  type: "text" | "password" | "number" | "boolean" | "select";
  options?: string[];
  default?: string | number | boolean;
};

export function readSettingsSchema(value: unknown): AppSettingField[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    if (typeof item['key'] !== "string" || typeof item['label'] !== "string") return [];
    const type = typeof item['type'] === "string" ? item['type'] : "text";
    const field: AppSettingField = {
      key: item['key'],
      label: item['label'],
      type: (["text", "password", "number", "boolean", "select"] as const).includes(
        type as AppSettingField["type"],
      )
        ? (type as AppSettingField["type"])
        : "text",
    };
    if (Array.isArray(item['options'])) {
      field.options = item['options'].filter((option): option is string => typeof option === "string");
    }
    const fallback = item['default'];
    if (typeof fallback === "string" || typeof fallback === "number" || typeof fallback === "boolean") {
      field.default = fallback;
    }
    return [field];
  });
}

export function appPriceLabel(
  pricingModel: string,
  price: number,
  currency: string,
  format: (value: number, currency?: string) => string,
): string {
  if (pricingModel === "free" || price <= 0) {
    return pricingModel === "usage" ? "Kullanım bazlı" : "Ücretsiz";
  }
  if (pricingModel === "monthly") return `${format(price, currency)} / ay`;
  if (pricingModel === "one_time") return `${format(price, currency)} tek seferlik`;
  return format(price, currency);
}
