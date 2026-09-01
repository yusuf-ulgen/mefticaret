/** Abonelik & paket sabitleri: metrik anahtarları yalnızca etiket/varsayılan içindir, limitler veritabanından okunur. */

export const METRIC_CATALOG = [
  { key: "products", label: "Ürün", unit: "adet" },
  { key: "orders", label: "Sipariş", unit: "adet/ay" },
  { key: "staff", label: "Personel", unit: "kişi" },
  { key: "storage", label: "Depolama", unit: "MB" },
  { key: "domains", label: "Domain", unit: "adet" },
  { key: "themes", label: "Tema", unit: "adet" },
  { key: "apps", label: "Uygulama", unit: "adet" },
  { key: "api_requests", label: "API", unit: "istek/ay" },
  { key: "ai_credits", label: "AI kullanımı", unit: "kredi/ay" },
  { key: "emails", label: "E-posta", unit: "adet/ay" },
  { key: "sms", label: "SMS", unit: "adet/ay" },
  { key: "monthly_sales", label: "Aylık satış", unit: "TRY/ay" },
] as const;

export type MetricKey = (typeof METRIC_CATALOG)[number]["key"];

/** Kullanımı canlı sayımdan gelen metrikler; diğerleri usage_records üzerinden toplanır. */
export const LIVE_METRICS: string[] = [
  "products",
  "orders",
  "staff",
  "domains",
  "themes",
  "monthly_sales",
];

export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  trialing: "Deneme sürecinde",
  active: "Aktif",
  past_due: "Ödeme gecikti",
  canceled: "İptal edildi",
  expired: "Süresi bitti",
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "Taslak",
  open: "Ödeme bekliyor",
  paid: "Ödendi",
  void: "İptal",
  uncollectible: "Tahsil edilemez",
};

export const BILLING_INTERVAL_LABELS: Record<string, string> = {
  monthly: "Aylık",
  yearly: "Yıllık",
};

export function limitLabel(value: number | null | undefined): string {
  if (value === null || value === undefined || value < 0) return "Sınırsız";
  return new Intl.NumberFormat("tr-TR").format(value);
}

export function limitRatio(used: number, limit: number | null | undefined): number | null {
  if (limit === null || limit === undefined || limit < 0) return null;
  if (limit === 0) return 100;
  return Math.min(100, Math.round((used / limit) * 100));
}

export function trialDaysLeft(trialEndsAt: string | null | undefined): number | null {
  if (!trialEndsAt) return null;
  const diff = new Date(trialEndsAt).getTime() - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / 86_400_000);
}
