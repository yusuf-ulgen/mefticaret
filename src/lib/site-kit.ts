/**
 * Site Kit: pazarlama & analitik servislerinin kod yazmadan bağlanmasını sağlayan
 * katalog. Alan tanımları hem panel formunu hem sunucu doğrulamasını besler.
 *
 * Gizli alanlar (`secret: true`) yalnızca sunucuda saklanır ve asla vitrine
 * ya da istemciye gönderilmez.
 */

export type SiteKitFieldType = "text" | "textarea";

export type SiteKitField = {
  key: string;
  label: string;
  hint: string;
  placeholder: string;
  type?: SiteKitFieldType;
  /** Sunucuda saklanır, panele maskeli döner. */
  secret?: boolean;
  required?: boolean;
  /** Basit format doğrulaması (panel + sunucu). */
  pattern?: string;
};

export type SiteKitCategory = "Analitik" | "Etiket yönetimi" | "SEO" | "Reklam" | "Sunucu izleme";

export type SiteKitProvider = {
  id: string;
  name: string;
  summary: string;
  category: SiteKitCategory;
  /** Kartta gösterilen "gerekli alan" özeti. */
  requirement: string;
  side: "client" | "server";
  /** Reklam engelleyicilerin engelleyebilmesi. */
  blockable: boolean;
  availability: "ready" | "soon";
  docsUrl: string;
  fields: SiteKitField[];
};

export const SITE_KIT_PROVIDERS: SiteKitProvider[] = [
  {
    id: "google_analytics_4",
    name: "Google Analytics 4",
    summary: "Ziyaretçi davranışı ve trafik analizi",
    category: "Analitik",
    requirement: "Measurement ID",
    side: "client",
    blockable: true,
    availability: "ready",
    docsUrl: "https://support.google.com/analytics/answer/9539598",
    fields: [
      {
        key: "measurementId",
        label: "Measurement ID",
        hint: "Analytics > Yönetici > Veri Akışları bölümünde bulabilirsiniz.",
        placeholder: "G-XXXXXXXXXX",
        required: true,
        pattern: "^G-[A-Z0-9]{6,}$",
      },
    ],
  },
  {
    id: "google_tag_manager",
    name: "Google Tag Manager",
    summary: "Tüm etiketleri tek noktadan yönetin",
    category: "Etiket yönetimi",
    requirement: "Container ID",
    side: "client",
    blockable: true,
    availability: "ready",
    docsUrl: "https://support.google.com/tagmanager/answer/6103696",
    fields: [
      {
        key: "containerId",
        label: "Container ID",
        hint: "Tag Manager çalışma alanınızın sağ üstünde yazan GTM- ile başlayan kimlik.",
        placeholder: "GTM-XXXXXXX",
        required: true,
        pattern: "^GTM-[A-Z0-9]{4,}$",
      },
    ],
  },
  {
    id: "google_search_console",
    name: "Google Search Console",
    summary: "Arama performansını izleyin",
    category: "SEO",
    requirement: "Doğrulama kodu",
    side: "client",
    blockable: false,
    availability: "ready",
    docsUrl: "https://support.google.com/webmasters/answer/9008080",
    fields: [
      {
        key: "verification",
        label: "HTML etiketi doğrulama kodu",
        hint: "Search Console > Mülk ekle > HTML etiketi adımındaki content değeri.",
        placeholder: "abc123def456...",
        required: true,
      },
    ],
  },
  {
    id: "google_ads",
    name: "Google Ads",
    summary: "Reklam dönüşümlerini takip edin",
    category: "Reklam",
    requirement: "Dönüşüm ID",
    side: "client",
    blockable: true,
    availability: "ready",
    docsUrl: "https://support.google.com/google-ads/answer/6095821",
    fields: [
      {
        key: "conversionId",
        label: "Dönüşüm ID",
        hint: "Google Ads > Araçlar > Dönüşümler ekranındaki AW- ile başlayan kimlik.",
        placeholder: "AW-123456789",
        required: true,
        pattern: "^AW-[0-9]{6,}$",
      },
      {
        key: "conversionLabel",
        label: "Dönüşüm etiketi (opsiyonel)",
        hint: "Satın alma dönüşümü için etiket değeri; boş bırakılabilir.",
        placeholder: "abcDEfGhIjKl",
      },
    ],
  },
  {
    id: "meta_pixel",
    name: "Meta Pixel",
    summary: "Facebook ve Instagram reklam izleme",
    category: "Reklam",
    requirement: "Pixel ID",
    side: "client",
    blockable: true,
    availability: "ready",
    docsUrl: "https://www.facebook.com/business/help/952192354843755",
    fields: [
      {
        key: "pixelId",
        label: "Pixel ID",
        hint: "Meta Events Manager > Veri Kaynakları listesindeki 15-16 haneli kimlik.",
        placeholder: "1234567890123456",
        required: true,
        pattern: "^[0-9]{10,20}$",
      },
    ],
  },
  {
    id: "facebook_capi",
    name: "Facebook Conversions API",
    summary: "Sunucu taraflı dönüşüm izleme",
    category: "Sunucu izleme",
    requirement: "Erişim token",
    side: "server",
    blockable: false,
    availability: "ready",
    docsUrl: "https://developers.facebook.com/docs/marketing-api/conversions-api",
    fields: [
      {
        key: "pixelId",
        label: "Pixel ID",
        hint: "Pixel ile aynı kimlik; olay tekilleştirme (deduplikasyon) için gerekir.",
        placeholder: "1234567890123456",
        required: true,
        pattern: "^[0-9]{10,20}$",
      },
      {
        key: "accessToken",
        label: "Erişim token",
        hint: "Events Manager > Ayarlar > Conversions API bölümünden üretilir. Yalnızca sunucuda saklanır.",
        placeholder: "EAAG...",
        secret: true,
        required: true,
        type: "textarea",
      },
      {
        key: "testEventCode",
        label: "Test olay kodu (opsiyonel)",
        hint: "Events Manager test aracı için geçici kod.",
        placeholder: "TEST12345",
        secret: true,
      },
    ],
  },
  {
    id: "tiktok_pixel",
    name: "TikTok Pixel",
    summary: "TikTok reklam performansını izleyin",
    category: "Reklam",
    requirement: "Pixel ID",
    side: "client",
    blockable: true,
    availability: "ready",
    docsUrl: "https://ads.tiktok.com/help/article/get-started-pixel",
    fields: [
      {
        key: "pixelId",
        label: "Pixel ID",
        hint: "TikTok Events Manager > Web Events ekranındaki pixel kimliği.",
        placeholder: "CXXXXXXXXXXXXXXXXXXX",
        required: true,
      },
    ],
  },
  {
    id: "pinterest_tag",
    name: "Pinterest Tag",
    summary: "Pinterest reklam dönüşümlerini izleyin",
    category: "Reklam",
    requirement: "Tag ID",
    side: "client",
    blockable: true,
    availability: "ready",
    docsUrl: "https://help.pinterest.com/business/article/track-conversions",
    fields: [
      {
        key: "tagId",
        label: "Tag ID",
        hint: "Pinterest Ads > Dönüşümler > Pinterest etiketi ekranındaki kimlik.",
        placeholder: "2612345678901",
        required: true,
        pattern: "^[0-9]{8,20}$",
      },
    ],
  },
  {
    id: "snapchat_pixel",
    name: "Snapchat Pixel",
    summary: "Snapchat reklam dönüşümlerini izleyin",
    category: "Reklam",
    requirement: "Pixel ID",
    side: "client",
    blockable: true,
    availability: "soon",
    docsUrl: "https://businesshelp.snapchat.com/s/article/snap-pixel-about",
    fields: [
      {
        key: "pixelId",
        label: "Pixel ID",
        hint: "Snapchat Ads Manager > Events Manager bölümünden alınır.",
        placeholder: "00000000-0000-0000-0000-000000000000",
        required: true,
      },
    ],
  },
  {
    id: "criteo_onetag",
    name: "Criteo OneTag",
    summary: "Criteo yeniden pazarlama etiketi",
    category: "Reklam",
    requirement: "Partner ID",
    side: "client",
    blockable: true,
    availability: "soon",
    docsUrl: "https://help.criteo.com/kb/guide/en/criteo-onetag-implementation",
    fields: [
      {
        key: "partnerId",
        label: "Partner ID",
        hint: "Criteo Management Center > Tags bölümündeki partner kimliği.",
        placeholder: "123456",
        required: true,
        pattern: "^[0-9]{4,12}$",
      },
    ],
  },
];

export const SITE_KIT_PROVIDER_IDS = SITE_KIT_PROVIDERS.map((provider) => provider.id);

export function siteKitProvider(id: string) {
  return SITE_KIT_PROVIDERS.find((provider) => provider.id === id) ?? null;
}

export type SiteKitStatus = "unconfigured" | "pending" | "connected" | "error" | "paused";

export const SITE_KIT_STATUS_LABELS: Record<SiteKitStatus, string> = {
  unconfigured: "Yapılandırılmadı",
  pending: "Doğrulama bekliyor",
  connected: "Bağlı",
  error: "Hata",
  paused: "Pasif",
};

/** Standart e-ticaret olayları ve hangi servislere gönderildiği. */
export const SITE_KIT_EVENTS = [
  {
    name: "page_view",
    label: "Sayfa görüntüleme",
    sample: "Ana sayfa",
    targets: ["google_analytics_4", "google_tag_manager"],
  },
  {
    name: "view_item",
    label: "Ürün görüntüleme",
    sample: "Ürün detay sayfası",
    targets: ["google_analytics_4", "meta_pixel", "google_tag_manager"],
  },
  {
    name: "add_to_cart",
    label: "Sepete ekleme",
    sample: "Sepete eklenen ürün ve fiyatı",
    targets: ["google_analytics_4", "meta_pixel", "tiktok_pixel"],
  },
  {
    name: "begin_checkout",
    label: "Ödeme başlatma",
    sample: "Sepet toplamı",
    targets: ["google_analytics_4", "meta_pixel"],
  },
  {
    name: "purchase",
    label: "Satın alma",
    sample: "Sipariş numarası ve tutarı",
    targets: ["google_analytics_4", "meta_pixel", "tiktok_pixel", "facebook_capi", "google_ads"],
  },
  {
    name: "search",
    label: "Site içi arama",
    sample: "Aranan terim ve sonuç sayısı",
    targets: ["google_analytics_4", "google_tag_manager"],
  },
] as const;

export const SITE_KIT_ADVANTAGES = [
  {
    title: "Otomatik dataLayer",
    body: "Ürün bilgisi, fiyat, kategori ve miktar sayfa yüklendiğinde otomatik hazırlanır.",
  },
  {
    title: "Çoklu servis desteği",
    body: "Tek bir olay (ör. purchase) aynı anda GA4, Meta Pixel ve TikTok Pixel'e gönderilir.",
  },
  {
    title: "Enhanced E-commerce",
    body: "GA4 Enhanced E-commerce standardına uyumlu ürün listesi ve promosyon olayları.",
  },
  {
    title: "Meta CAPI + Pixel deduplikasyon",
    body: "Tarayıcı ve sunucu olayları aynı event_id ile gönderilir, Meta tekrarları filtreler.",
  },
  {
    title: "Enhanced matching",
    body: "E-posta ve telefon bilgileri hash'lenerek gönderilir, eşleşme oranı yükselir.",
  },
  {
    title: "iOS 14.5+ uyumlu",
    body: "App Tracking Transparency kısıtlamalarını sunucu taraflı izleme ile aşın.",
  },
  {
    title: "KVKK / GDPR uyumlu",
    body: "Çerez izni bileşeniyle entegre çalışır; onay verilmeden izleme başlatılmaz.",
  },
];

export type SiteKitConfigRow = {
  provider: string;
  isEnabled: boolean;
  status: SiteKitStatus;
  publicConfig: Record<string, string>;
  /** Gizli alanların dolu olup olmadığı; değerin kendisi asla dönmez. */
  secretsFilled: Record<string, boolean>;
  lastTestedAt: string | null;
  lastTestResult: string | null;
};

/** Panel formundan gelen değerleri katalog kurallarına göre doğrular. */
export function validateSiteKitValues(
  providerId: string,
  values: Record<string, string>,
  options: { secretsAlreadyFilled?: Record<string, boolean> } = {},
): string | null {
  const provider = siteKitProvider(providerId);
  if (!provider) return "Bilinmeyen servis";
  for (const field of provider.fields) {
    const raw = (values[field.key] ?? "").trim();
    const filled = raw.length > 0 || (field.secret && options.secretsAlreadyFilled?.[field.key]);
    if (field.required && !filled) return `${field.label} zorunludur`;
    if (raw && field.pattern && !new RegExp(field.pattern).test(raw)) {
      return `${field.label} biçimi geçersiz (${field.placeholder})`;
    }
  }
  return null;
}
