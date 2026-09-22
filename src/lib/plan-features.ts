/**
 * Paket özellikleri (modüller) kataloğu.
 *
 * Limitler (`METRIC_CATALOG`) sayısal kotalardır; buradaki modül anahtarları ise
 * aç/kapa özelliklerdir. Her ikisi de `plan_features` tablosunda tutulur:
 * modüller `module_` önekiyle, `limit_value = null` ve `is_enabled` ile yönetilir.
 * Kodda sabit limit yoktur; kaynak her zaman veritabanıdır.
 */

export type PlanModule = {
  key: string;
  label: string;
  description: string;
  /** Bu modüle ait mağaza paneli rota son ekleri (`/store/:id/<suffix>`). */
  routes: string[];
};

export const MODULE_PREFIX = "module_";

export const MODULE_CATALOG: PlanModule[] = [
  {
    key: "module_product_feeds",
    label: "Ürün Akışları",
    description: "Google Shopping, TikTok, Instagram ve Facebook katalog akışları.",
    routes: ["feeds"],
  },
  {
    key: "module_xml_integrator",
    label: "XML Entegratör",
    description: "Tedarikçi XML/CSV beslemeleri ve pazaryeri XML çıktıları.",
    routes: ["xml-integrator"],
  },
  {
    key: "module_migration",
    label: "Mağaza Taşıma",
    description: "Diğer platformlardan ürün, sipariş ve müşteri aktarımı.",
    routes: ["migration"],
  },
  {
    key: "module_automation",
    label: "Otomasyon Akışları",
    description: "Görsel otomasyon kurgusu ve tetikleyiciler.",
    routes: ["automations"],
  },
  {
    key: "module_omnichannel",
    label: "Omni-Channel Mesajlaşma",
    description: "Mesaj merkezi, WhatsApp, Instagram ve TikTok otomasyonu.",
    routes: ["inbox", "whatsapp", "instagram", "tiktok"],
  },
  {
    key: "module_ai",
    label: "AI Stüdyo",
    description: "AI içerik, açıklama, hukuki metin ve asistan.",
    routes: ["ai", "ai-studio", "copilot"],
  },
  {
    key: "module_multi_language",
    label: "Çoklu Dil & Çeviri",
    description: "Dil merkezi, çeviri ve hreflang yönetimi.",
    routes: ["languages"],
  },
  {
    key: "module_advanced_analytics",
    label: "İleri Analitik",
    description: "Kohort, LTV, huni, sepet ve tahmin raporları.",
    routes: [
      "cohorts",
      "ltv",
      "forecast",
      "funnel",
      "basket",
      "geo",
      "repurchase",
      "elasticity",
      "lifecycle",
      "review-impact",
      "abc",
      "campaigns",
      "report-monthly",
      "returns-analytics",
      "supplier-performance",
      "support-performance",
      "team-performance",
      "shipping-economics",
      "shipping-performance",
      "simulator",
    ],
  },
  {
    key: "module_marketplace",
    label: "Pazaryeri Operasyonu",
    description: "Pazaryeri kanalları, satıcılar, mutabakat ve iadeler.",
    routes: [
      "channels",
      "sellers",
      "marketplace-returns",
      "settlements",
      "marketplace-analytics",
      "listing-links",
      "facebook-marketplace",
    ],
  },
  {
    key: "module_mobile_app",
    label: "Mobil Uygulama",
    description: "iOS/Android uygulama düzenleyici ve push bildirimleri.",
    routes: ["mobile-app"],
  },
  {
    key: "module_multi_currency",
    label: "Marketler & Çoklu Para Birimi",
    description: "Ülke bazlı market, kur ve fiyatlandırma motoru.",
    routes: ["markets-pricing", "localization"],
  },
  {
    key: "module_api",
    label: "API & Webhook",
    description: "Genel API anahtarları, webhook ve OAuth uygulamaları.",
    routes: ["api", "webhooks", "oauth"],
  },
];

export const MODULE_BY_KEY: Record<string, PlanModule> = Object.fromEntries(
  MODULE_CATALOG.map((module) => [module.key, module]),
);

/** Rota son eki -> modül anahtarı eşlemesi. */
export const MODULE_BY_ROUTE: Record<string, string> = Object.fromEntries(
  MODULE_CATALOG.flatMap((module) => module.routes.map((route) => [route, module.key])),
);

export function isModuleKey(key: string): boolean {
  return key.startsWith(MODULE_PREFIX);
}

/** `/store/:id/<suffix>` yolundaki modül anahtarını çözer. */
export function moduleKeyForPath(pathname: string): string | null {
  const match = /^\/store\/[^/]+\/([^/?#]+)/.exec(pathname);
  if (!match) return null;
  return MODULE_BY_ROUTE[match[1] as string] ?? null;
}

export type Entitlements = {
  planId: string | null;
  planCode: string | null;
  planName: string | null;
  /** Modül anahtarı -> açık mı. Tanımlı olmayan modül kapalı sayılır. */
  modules: Record<string, boolean>;
  /** Metrik anahtarı -> limit (null/negatif = sınırsız). */
  limits: Record<string, number | null>;
};

export const EMPTY_ENTITLEMENTS: Entitlements = {
  planId: null,
  planCode: null,
  planName: null,
  modules: {},
  limits: {},
};

export function hasModule(entitlements: Entitlements | null | undefined, key: string): boolean {
  if (!entitlements) return false;
  return entitlements.modules[key] === true;
}

/** Limit aşıldı mı? `null`/negatif limit sınırsızdır. */
export function limitExceeded(limit: number | null | undefined, used: number): boolean {
  if (limit === null || limit === undefined || limit < 0) return false;
  return used >= limit;
}
