/**
 * Süper admin panelindeki platform genelinde listelerin tanımı.
 * Sunucu yalnızca bu beyaz listedeki veri kümelerini okur; istemci sütunları buradan render eder.
 */

export type PlatformColumn = {
  key: string;
  label: string;
  kind?: "text" | "date" | "money" | "number" | "badge" | "boolean" | "percent" | "json";
};

export type PlatformDataset = {
  /** Okunacak tablo. */
  table: string;
  title: string;
  description: string;
  /** Sıralama kolonu (azalan). */
  orderBy: string;
  /** Serbest metin aramasında taranan kolonlar. */
  searchColumns: string[];
  /** Sabit filtreler: kolon -> izinli değerler. */
  filter?: Record<string, string[]>;
  columns: PlatformColumn[];
  /** Mağaza adı sütunu eklenir mi (store_id üzerinden). */
  withStore?: boolean;
};

const DATASETS = {
  users: {
    table: "profiles",
    title: "Kullanıcılar",
    description: "Platformdaki tüm hesaplar, iletişim bilgileri ve rolleri.",
    orderBy: "created_at",
    searchColumns: ["email", "full_name", "phone"],
    columns: [
      { key: "full_name", label: "Ad Soyad" },
      { key: "email", label: "E-posta" },
      { key: "phone", label: "Telefon" },
      { key: "locale", label: "Dil", kind: "badge" },
      { key: "created_at", label: "Kayıt", kind: "date" },
    ],
  },
  sellers: {
    table: "marketplace_sellers",
    title: "Satıcılar",
    description: "Marketplace satıcı başvuruları, komisyon oranları ve durumları.",
    orderBy: "created_at",
    searchColumns: ["display_name", "legal_name", "email"],
    withStore: true,
    columns: [
      { key: "display_name", label: "Satıcı" },
      { key: "email", label: "E-posta" },
      { key: "commission_rate", label: "Komisyon", kind: "percent" },
      { key: "status", label: "Durum", kind: "badge" },
      { key: "created_at", label: "Başvuru", kind: "date" },
    ],
  },
  marketplace: {
    table: "marketplace_channels",
    title: "Marketplace kanalları",
    description: "Pazaryeri entegrasyonlarının bağlantı ve senkronizasyon durumu.",
    orderBy: "created_at",
    searchColumns: ["provider", "name"],
    withStore: true,
    columns: [
      { key: "name", label: "Kanal" },
      { key: "provider", label: "Sağlayıcı", kind: "badge" },
      { key: "status", label: "Durum", kind: "badge" },
      { key: "auto_sync", label: "Oto. senkron", kind: "boolean" },
      { key: "last_sync_at", label: "Son senkron", kind: "date" },
    ],
  },
  subscriptions: {
    table: "subscriptions",
    title: "Abonelikler",
    description: "Mağaza abonelikleri, dönemleri ve deneme süreleri.",
    orderBy: "created_at",
    searchColumns: [],
    withStore: true,
    columns: [
      { key: "status", label: "Durum", kind: "badge" },
      { key: "billing_interval", label: "Dönem", kind: "badge" },
      { key: "amount", label: "Tutar", kind: "money" },
      { key: "current_period_start", label: "Dönem başı", kind: "date" },
      { key: "current_period_end", label: "Dönem sonu", kind: "date" },
      { key: "trial_ends_at", label: "Deneme bitiş", kind: "date" },
    ],
  },
  payments: {
    table: "payouts",
    title: "Ödemeler",
    description: "Mağaza hak edişleri, kesintiler ve ödeme durumları.",
    orderBy: "created_at",
    searchColumns: ["reference"],
    withStore: true,
    columns: [
      { key: "period_start", label: "Dönem başı", kind: "date" },
      { key: "gross_amount", label: "Brüt", kind: "money" },
      { key: "fee_amount", label: "Kesinti", kind: "money" },
      { key: "net_amount", label: "Net", kind: "money" },
      { key: "status", label: "Durum", kind: "badge" },
      { key: "paid_at", label: "Ödeme", kind: "date" },
    ],
  },
  transactions: {
    table: "ledger_entries",
    title: "İşlemler",
    description: "Değiştirilemez finans defterindeki tüm hareketler.",
    orderBy: "occurred_at",
    searchColumns: ["description", "reference"],
    withStore: true,
    columns: [
      { key: "occurred_at", label: "Tarih", kind: "date" },
      { key: "kind", label: "Tür", kind: "badge" },
      { key: "direction", label: "Yön", kind: "badge" },
      { key: "amount", label: "Tutar", kind: "money" },
      { key: "status", label: "Durum", kind: "badge" },
      { key: "description", label: "Açıklama" },
    ],
  },
  commissions: {
    table: "ledger_entries",
    title: "Komisyonlar",
    description: "Platform komisyonu ve marketplace komisyon hareketleri.",
    orderBy: "occurred_at",
    searchColumns: ["description", "reference"],
    filter: { kind: ["platform_fee", "marketplace_commission"] },
    withStore: true,
    columns: [
      { key: "occurred_at", label: "Tarih", kind: "date" },
      { key: "kind", label: "Tür", kind: "badge" },
      { key: "amount", label: "Tutar", kind: "money" },
      { key: "status", label: "Durum", kind: "badge" },
      { key: "description", label: "Açıklama" },
    ],
  },
  themes: {
    table: "store_themes",
    title: "Temalar",
    description: "Mağaza temaları, yayın durumu ve özel kod kullanımı.",
    orderBy: "updated_at",
    searchColumns: ["preset", "layout"],
    withStore: true,
    columns: [
      { key: "preset", label: "Şablon", kind: "badge" },
      { key: "layout", label: "Düzen", kind: "badge" },
      { key: "font_pair", label: "Yazı tipi" },
      { key: "is_published", label: "Yayında", kind: "boolean" },
      { key: "updated_at", label: "Güncelleme", kind: "date" },
    ],
  },
  apps: {
    table: "apps",
    title: "Uygulamalar",
    description: "Uygulama mağazasındaki kayıtlar, kurulum sayıları ve fiyatlama.",
    orderBy: "created_at",
    searchColumns: ["name", "code", "developer"],
    columns: [
      { key: "name", label: "Uygulama" },
      { key: "category", label: "Kategori", kind: "badge" },
      { key: "pricing_model", label: "Fiyatlama", kind: "badge" },
      { key: "price", label: "Fiyat", kind: "money" },
      { key: "install_count", label: "Kurulum", kind: "number" },
      { key: "is_active", label: "Aktif", kind: "boolean" },
    ],
  },
  api: {
    table: "api_keys",
    title: "API anahtarları",
    description: "Scope tabanlı API anahtarları ve kullanım istatistikleri.",
    orderBy: "created_at",
    searchColumns: ["name", "key_prefix"],
    withStore: true,
    columns: [
      { key: "name", label: "Anahtar" },
      { key: "key_prefix", label: "Ön ek", kind: "badge" },
      { key: "api_version", label: "Sürüm", kind: "badge" },
      { key: "request_count", label: "İstek", kind: "number" },
      { key: "last_used_at", label: "Son kullanım", kind: "date" },
      { key: "revoked_at", label: "İptal", kind: "date" },
    ],
  },
  webhooks: {
    table: "store_webhooks",
    title: "Webhook'lar",
    description: "Kayıtlı webhook uç noktaları, olaylar ve son hatalar.",
    orderBy: "created_at",
    searchColumns: ["name", "target_url"],
    withStore: true,
    columns: [
      { key: "name", label: "Webhook" },
      { key: "target_url", label: "Adres" },
      { key: "is_active", label: "Aktif", kind: "boolean" },
      { key: "last_triggered_at", label: "Son tetik", kind: "date" },
      { key: "last_error", label: "Son hata" },
    ],
  },
  cms: {
    table: "store_pages",
    title: "CMS sayfaları",
    description: "Tüm mağazaların kurumsal ve özel sayfaları.",
    orderBy: "updated_at",
    searchColumns: ["title", "slug"],
    filter: { page_kind: ["page"] },
    withStore: true,
    columns: [
      { key: "title", label: "Sayfa" },
      { key: "slug", label: "Adres" },
      { key: "status", label: "Durum", kind: "badge" },
      { key: "is_published", label: "Yayında", kind: "boolean" },
      { key: "updated_at", label: "Güncelleme", kind: "date" },
    ],
  },
  blog: {
    table: "store_pages",
    title: "Blog yazıları",
    description: "Platform genelinde blog içerikleri ve yayın takvimi.",
    orderBy: "published_at",
    searchColumns: ["title", "slug", "author_name"],
    filter: { page_kind: ["blog", "post"] },
    withStore: true,
    columns: [
      { key: "title", label: "Yazı" },
      { key: "author_name", label: "Yazar" },
      { key: "status", label: "Durum", kind: "badge" },
      { key: "published_at", label: "Yayın", kind: "date" },
      { key: "scheduled_at", label: "Planlanan", kind: "date" },
    ],
  },
  notifications: {
    table: "notifications",
    title: "Bildirimler",
    description: "Platform genelinde üretilen bildirim akışı.",
    orderBy: "created_at",
    searchColumns: ["title", "message"],
    withStore: true,
    columns: [
      { key: "created_at", label: "Tarih", kind: "date" },
      { key: "kind", label: "Tür", kind: "badge" },
      { key: "title", label: "Başlık" },
      { key: "message", label: "Mesaj" },
      { key: "is_read", label: "Okundu", kind: "boolean" },
    ],
  },
  coupons: {
    table: "discounts",
    title: "Kuponlar",
    description: "Tüm mağazaların indirim kuponları ve kullanım oranları.",
    orderBy: "created_at",
    searchColumns: ["code", "title"],
    withStore: true,
    columns: [
      { key: "code", label: "Kod", kind: "badge" },
      { key: "title", label: "Başlık" },
      { key: "type", label: "Tür", kind: "badge" },
      { key: "value", label: "Değer", kind: "number" },
      { key: "used_count", label: "Kullanım", kind: "number" },
      { key: "is_active", label: "Aktif", kind: "boolean" },
    ],
  },
  analytics: {
    table: "store_daily_stats",
    title: "Analitik",
    description: "Mağaza bazlı günlük ciro, sipariş ve ziyaretçi verileri.",
    orderBy: "stat_date",
    searchColumns: [],
    withStore: true,
    columns: [
      { key: "stat_date", label: "Gün", kind: "date" },
      { key: "revenue", label: "Ciro", kind: "money" },
      { key: "orders_count", label: "Sipariş", kind: "number" },
      { key: "visitors", label: "Ziyaretçi", kind: "number" },
      { key: "new_customers", label: "Yeni müşteri", kind: "number" },
      { key: "abandoned_carts", label: "Terk edilen sepet", kind: "number" },
    ],
  },
  audit: {
    table: "audit_logs",
    title: "Audit Logs",
    description: "Platform genelinde denetim kayıtları.",
    orderBy: "created_at",
    searchColumns: ["action", "entity", "entity_id"],
    withStore: true,
    columns: [
      { key: "created_at", label: "Tarih", kind: "date" },
      { key: "action", label: "İşlem", kind: "badge" },
      { key: "entity", label: "Varlık" },
      { key: "entity_id", label: "Kayıt" },
      { key: "ip", label: "IP" },
    ],
  },
  security: {
    table: "security_events",
    title: "Güvenlik olayları",
    description: "Hız sınırı ihlalleri, yetkisiz erişim denemeleri ve şüpheli hareketler.",
    orderBy: "created_at",
    searchColumns: ["kind", "severity", "ip"],
    withStore: true,
    columns: [
      { key: "created_at", label: "Tarih", kind: "date" },
      { key: "kind", label: "Olay", kind: "badge" },
      { key: "severity", label: "Önem", kind: "badge" },
      { key: "ip", label: "IP" },
      { key: "meta", label: "Detay", kind: "json" },
    ],
  },
} satisfies Record<string, PlatformDataset>;

export const PLATFORM_DATASETS: Record<keyof typeof DATASETS, PlatformDataset> = DATASETS;

export type PlatformDatasetKey = keyof typeof DATASETS;

export const PLATFORM_DATASET_KEYS = Object.keys(PLATFORM_DATASETS) as PlatformDatasetKey[];
