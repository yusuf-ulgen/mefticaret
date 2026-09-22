import { storeNavGroups, type StoreNavItem } from "@/lib/store-nav";

/**
 * Tüm panel ekranlarının tek kataloğu.
 *
 * Menüdeki gruplar tek kaynak olarak kullanılır; burada yalnızca
 *  - aynı işi yapan ekranlar tek karta birleştirilir,
 *  - her karta kısa bir açıklama eklenir.
 */

export type PanelCard = {
  /** Kartın ana ekranı. */
  main: StoreNavItem;
  /** Aynı konuya ait, kart içinden açılan diğer ekranlar. */
  related: StoreNavItem[];
  group: string;
  description: string;
  search: string;
};

export type PanelSection = {
  group: string;
  icon: React.ComponentType<{ className?: string }>;
  cards: PanelCard[];
};

/**
 * Aynı konuyu paylaşan ekranlar. Anahtar ana ekranın yolu (son parça),
 * değer ise kart içinde alt bağlantı olarak gösterilecek ekranlar.
 */
const MERGE: Record<string, string[]> = {
  segments: ["customer-segments"],
  seo: ["seo-editor"],
  "theme-editor": ["theme-design", "theme-sections", "themes", "theme-store"],
  statistics: ["analytics", "reports", "report-monthly"],
  finance: ["ledger", "cashflow", "receivables"],
  inventory: ["stock-count", "valuation", "aging"],
  channels: ["listing-links", "marketplace-analytics", "marketplace-returns", "settlements", "sellers"],
  inbox: ["instagram", "tiktok", "whatsapp"],
  support: ["questions", "reviews", "support-performance"],
  shipping: ["shipping-performance", "shipping-economics"],
  api: ["oauth", "webhooks"],
  security: ["activity"],
  marketing: ["automations", "campaigns", "popups", "social-share", "feeds"],
};

/** Kart başlıklarının altında görünen kısa açıklamalar. */
const DESCRIPTIONS: Record<string, string> = {
  dashboard: "Günlük satış, sipariş ve stok özeti.",
  setup: "Mağazayı yayına almak için adım adım kontrol listesi.",
  live: "Ziyaretçi ve sipariş hareketlerini canlı izle.",
  tasks: "Bekleyen operasyon işlerini tek listede topla.",
  notifications: "Sipariş, stok ve destek bildirimleri.",
  health: "Yayın öncesi eksik ayarların kontrolü.",
  jobs: "Arka plan işleri ve önbellek durumu.",
  panels: "Tüm panel ekranlarının listesi.",
  products: "Ürün, varyant, fiyat ve stok yönetimi.",
  collections: "Kategori ve koleksiyon düzeni.",
  media: "Görsel ve dosya kütüphanesi.",
  pricing: "Fiyat kuralları ve toplu fiyat güncelleme.",
  barcodes: "Barkod ve raf etiketi çıktısı.",
  "import-export": "CSV ile toplu ürün aktarımı.",
  migration: "Başka altyapıdan veri taşıma.",
  inventory: "Stok seviyeleri, sayım, değerleme ve yaşlandırma.",
  warehouses: "Depo ve şube tanımları.",
  transfers: "Depolar arası stok transferi.",
  purchasing: "Tedarik siparişleri ve satın alma.",
  "xml-integrator": "Tedarikçi XML/CSV beslemeleri ve pazaryeri XML çıktıları.",
  reorder: "Yeniden sipariş önerileri.",
  stockout: "Tükenmek üzere olan ürünler.",
  "stock-alerts": "Stok gelince müşteriye haber verme.",
  orders: "Sipariş akışı, ödeme ve kargo durumu.",
  shipments: "Sevkiyat ve kargo etiketleri.",
  returns: "İade ve değişim talepleri.",
  carts: "Terk edilen sepetler ve kurtarma.",
  sla: "Sipariş karşılama süreleri.",
  losses: "İptal ve kayıp analizi.",
  customers: "Müşteri kayıtları ve harcama özeti.",
  segments: "Müşteri segmentleri ve hedefleme listeleri.",
  reviews: "Ürün değerlendirmeleri.",
  questions: "Ürün soruları ve yanıtlar.",
  support: "Destek talepleri, sorular ve değerlendirmeler.",
  inbox: "Instagram, TikTok ve WhatsApp mesajları tek gelen kutusunda.",
  marketing: "Kampanya, otomasyon, popup ve akış yönetimi.",
  discounts: "İndirim ve kupon kuralları.",
  "gift-cards": "Hediye kartı satışı ve bakiyeleri.",
  seo: "SEO denetimi ve sayfa etiketleri.",
  channels: "Pazaryeri ilanları, iadeler ve hakediş.",
  "facebook-marketplace": "Facebook Marketplace ilan aktarımı.",
  languages: "Dil, çeviri ve hreflang yönetimi.",
  "site-kit": "GA4, GTM, Meta Pixel ve dönüşüm takibi.",
  "theme-editor": "Vitrin teması, tasarım sistemi ve tema mağazası.",
  "mobile-app": "iOS/Android uygulama tasarımı ve push.",
  navigation: "Vitrin menüleri ve bağlantılar.",
  pages: "İçerik sayfaları.",
  blog: "Blog yazıları ve CMS.",
  domains: "Alan adı bağlama ve SSL.",
  finance: "Gelir, defter, nakit akışı ve tahsilat.",
  profit: "Ürün ve sipariş kârlılığı.",
  tax: "KDV ve vergi raporu.",
  "gift-liability": "Hediye kartı yükümlülüğü.",
  billing: "Paket, fatura ve abonelik.",
  statistics: "Satış, trafik, ürün ve dönüşüm raporları.",
  forecast: "Ciro tahmini.",
  cohorts: "Kohort tablosu ve elde tutma.",
  funnel: "Dönüşüm hunisi.",
  basket: "Birlikte satın alınan ürünler.",
  geo: "Şehir ve ülke dağılımı.",
  ltv: "Müşteri yaşam boyu değeri.",
  repurchase: "Tekrar satın alma oranı.",
  "returns-analytics": "İade nedenleri ve oranları.",
  elasticity: "İndirim derinliği ve talep esnekliği.",
  lifecycle: "Ürün yaşam döngüsü.",
  "review-impact": "Değerlendirmelerin satışa etkisi.",
  abc: "ABC analizi ve stok devir hızı.",
  vendors: "Marka performansı.",
  "supplier-performance": "Tedarikçi teslim performansı.",
  "team-performance": "Personel performansı.",
  simulator: "Senaryo simülasyonu.",
  shipping: "Kargo ayarları, performans ve maliyet.",
  copilot: "Panel içi yapay zekâ asistanı.",
  ai: "AI destekli içerik ve öneriler.",
  "ai-studio": "AI içerik stüdyosu.",
  settings: "Mağaza bilgileri ve genel ayarlar.",
  payments: "Ödeme yöntemleri.",
  localization: "Dil ve para birimi.",
  "markets-pricing": "Ülke bazlı fiyat ve kur yönetimi.",
  team: "Ekip üyeleri ve yetkiler.",
  security: "Güvenlik, KVKK ve denetim kaydı.",
  apps: "Uygulama mağazası ve entegrasyonlar.",
  api: "API anahtarları, OAuth ve webhook'lar.",
};

const slug = (to: string) => to.split("/").filter(Boolean).pop() ?? to;

/** Menü ağacından birleştirilmiş panel kataloğunu üretir. */
export function panelSections(storeId: string): PanelSection[] {
  const groups = storeNavGroups(storeId);
  const bySlug = new Map<string, StoreNavItem>();
  for (const group of groups) for (const item of group.items) bySlug.set(slug(item.to), item);

  /** Alt bağlantı olarak gösterilecek, dolayısıyla ayrı kart açılmayacak ekranlar. */
  const merged = new Set(Object.values(MERGE).flat());

  return groups.map((group) => ({
    group: group.group,
    icon: group.icon,
    cards: group.items
      .filter((item) => !merged.has(slug(item.to)))
      .map((item) => {
        const key = slug(item.to);
        const related = (MERGE[key] ?? [])
          .map((childSlug) => bySlug.get(childSlug))
          .filter((child): child is StoreNavItem => Boolean(child));
        return {
          main: item,
          related,
          group: group.group,
          description: DESCRIPTIONS[key] ?? item.keywords ?? "",
          search: [
            item.label,
            group.group,
            item.keywords ?? "",
            DESCRIPTIONS[key] ?? "",
            ...related.map((child) => `${child.label} ${child.keywords ?? ""}`),
          ]
            .join(" ")
            .toLocaleLowerCase("tr"),
        };
      }),
  }));
}

/** Katalogdaki toplam ekran sayısı (birleştirilenler dahil). */
export function panelScreenCount(storeId: string): number {
  return panelSections(storeId).reduce(
    (sum, section) =>
      sum + section.cards.reduce((inner, card) => inner + 1 + card.related.length, 0),
    0,
  );
}
