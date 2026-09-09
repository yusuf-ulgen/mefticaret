import { z } from "zod";

/**
 * Mefticaret Native Mobile App Builder — paylaşılan şema.
 *
 * Bu dosya hem web editöründe hem de sunucu tarafında kullanılır. Mobil
 * (React Native / Expo) white-label çekirdek, `/api/public/mobile-app/<slug>`
 * üzerinden bu JSON'u okuyup ekranı dinamik render eder.
 */

/* ------------------------------------------------------------------ */
/* Widget kataloğu                                                     */
/* ------------------------------------------------------------------ */

export const MOBILE_WIDGET_TYPES = [
  "announcement_ticker",
  "search_bar",
  "stories",
  "hero_carousel",
  "category_circles",
  "flash_sale",
  "product_grid",
  "lookbook",
  "banner",
  "text_block",
] as const;

export type MobileWidgetType = (typeof MOBILE_WIDGET_TYPES)[number];

export const WIDGET_CATALOG: {
  type: MobileWidgetType;
  name: string;
  description: string;
  emoji: string;
}[] = [
  {
    type: "announcement_ticker",
    name: "Duyuru Şeridi",
    description: "Ekranın üstünde kayan duyuru metni.",
    emoji: "📣",
  },
  { type: "search_bar", name: "Arama Çubuğu", description: "Arama, barkod ve sesli arama girişi.", emoji: "🔍" },
  {
    type: "stories",
    name: "Hikayeler",
    description: "Instagram tarzı, ürüne/kategoriye giden hikaye baloncukları.",
    emoji: "⭕",
  },
  { type: "hero_carousel", name: "Kampanya Slider", description: "Tam ekran kampanya görselleri.", emoji: "🖼️" },
  { type: "category_circles", name: "Kategori Daireleri", description: "Yuvarlak kategori kayar bandı.", emoji: "🔵" },
  { type: "flash_sale", name: "Flash İndirim", description: "Geri sayım sayacı + indirimli ürünler.", emoji: "⏱️" },
  { type: "product_grid", name: "Ürün Izgarası", description: "Dinamik ürün listesi (2/3 kolon).", emoji: "🧱" },
  { type: "lookbook", name: "Lookbook", description: "Görsel üzeri tıkla-satın al noktaları.", emoji: "👗" },
  { type: "banner", name: "Tek Banner", description: "Tek görsel + tıklama hedefi.", emoji: "🏷️" },
  { type: "text_block", name: "Metin Bloğu", description: "Başlık ve açıklama metni.", emoji: "📝" },
];

/* ------------------------------------------------------------------ */
/* Deep link motoru                                                    */
/* ------------------------------------------------------------------ */

export const DEEP_LINK_KINDS = ["home", "product", "collection", "category", "page", "cart", "search", "account", "url"] as const;
export type DeepLinkKind = (typeof DEEP_LINK_KINDS)[number];

export const DEEP_LINK_LABELS: Record<DeepLinkKind, string> = {
  home: "Ana sayfa",
  product: "Ürün detayı (PDP)",
  collection: "Koleksiyon (PLP)",
  category: "Kategori (PLP)",
  page: "İçerik sayfası",
  cart: "Sepet",
  search: "Arama",
  account: "Hesabım",
  url: "Dış bağlantı",
};

/** `mefticaret://product/kasmir-kazak` biçiminde derin bağlantı üretir. */
export function buildDeepLink(kind: DeepLinkKind, handle?: string | null): string {
  if (kind === "url") return handle?.trim() ?? "";
  const base = `mefticaret://${kind}`;
  const slug = handle?.trim().replace(/^\/+|\/+$/g, "");
  return slug ? `${base}/${slug}` : base;
}

/** Derin bağlantıyı mobil yönlendirme için ayrıştırır. */
export function parseDeepLink(link: string): { kind: DeepLinkKind; handle: string | null } {
  const value = (link ?? "").trim();
  if (!value) return { kind: "home", handle: null };
  if (/^https?:\/\//i.test(value)) return { kind: "url", handle: value };
  const match = /^mefticaret:\/\/([a-z]+)(?:\/(.*))?$/i.exec(value);
  if (!match) return { kind: "home", handle: null };
  const kind = (DEEP_LINK_KINDS as readonly string[]).includes(match[1]!.toLowerCase())
    ? (match[1]!.toLowerCase() as DeepLinkKind)
    : "home";
  return { kind, handle: match[2] ? match[2] : null };
}

/** Derin bağlantıyı vitrindeki web yoluna çevirir (push tıklaması / fallback). */
export function deepLinkToWebPath(link: string, storeSlug: string): string {
  const { kind, handle } = parseDeepLink(link);
  const base = `/s/${storeSlug}`;
  switch (kind) {
    case "product":
      return handle ? `${base}/p/${handle}` : `${base}/products`;
    case "collection":
    case "category":
      return handle ? `${base}/c/${handle}` : `${base}/collections`;
    case "page":
      return handle ? `${base}/page/${handle}` : base;
    case "cart":
      return `${base}/cart`;
    case "search":
      return handle ? `${base}/search?q=${encodeURIComponent(handle)}` : `${base}/search`;
    case "account":
      return `${base}/orders`;
    case "url":
      return handle ?? base;
    default:
      return base;
  }
}

/* ------------------------------------------------------------------ */
/* Şema                                                                */
/* ------------------------------------------------------------------ */

const hex = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .catch("#111111");

const safeText = (max: number, fallback = "") =>
  z.string().trim().max(max).catch(fallback);

const linkText = z
  .string()
  .trim()
  .max(300)
  .refine((value) => value === "" || /^(mefticaret:\/\/|https:\/\/)/i.test(value), "Geçersiz bağlantı")
  .catch("");

const widgetItemSchema = z.object({
  id: safeText(40, "item"),
  label: safeText(60),
  imageUrl: safeText(500),
  link: linkText,
});

export type MobileWidgetItem = z.infer<typeof widgetItemSchema>;

const widgetSchema = z.object({
  id: safeText(40, "widget"),
  type: z.enum(MOBILE_WIDGET_TYPES).catch("banner"),
  visible: z.boolean().catch(true),
  title: safeText(80),
  subtitle: safeText(160),
  imageUrl: safeText(500),
  link: linkText,
  columns: z.number().int().min(1).max(3).catch(2),
  limit: z.number().int().min(1).max(24).catch(6),
  autoplay: z.boolean().catch(true),
  endsAt: safeText(40),
  items: z.array(widgetItemSchema).max(20).catch([]),
});

export type MobileWidget = z.infer<typeof widgetSchema>;

const brandingSchema = z.object({
  appName: safeText(40, "Mağazam"),
  tagline: safeText(80, "Mobil alışverişin en hızlı hali"),
  description: safeText(400, ""),
  primary: hex,
  accent: hex,
  background: hex,
  surface: hex,
  text: hex,
  headingFont: z.enum(["Geist", "Inter", "Montserrat", "Nunito Sans", "Poppins"]).catch("Geist"),
  radius: z.number().int().min(0).max(32).catch(14),
  appIconUrl: safeText(500),
  splashImageUrl: safeText(500),
  splashBackground: hex,
  darkMode: z.boolean().catch(false),
});

export type MobileBranding = z.infer<typeof brandingSchema>;

export const TAB_KEYS = ["home", "categories", "search", "favorites", "cart", "account"] as const;
export type TabKey = (typeof TAB_KEYS)[number];

export const TAB_LABELS: Record<TabKey, string> = {
  home: "Ana Sayfa",
  categories: "Kategoriler",
  search: "Arama",
  favorites: "Favoriler",
  cart: "Sepet",
  account: "Hesabım",
};

const tabSchema = z.object({
  key: z.enum(TAB_KEYS).catch("home"),
  label: safeText(20, "Ana Sayfa"),
  visible: z.boolean().catch(true),
});

const drawerItemSchema = z.object({
  id: safeText(40, "drawer"),
  label: safeText(40),
  link: linkText,
});

const navigationSchema = z.object({
  tabs: z.array(tabSchema).max(6).catch([]),
  drawer: z.array(drawerItemSchema).max(20).catch([]),
  showDrawer: z.boolean().catch(true),
});

const commerceSchema = z.object({
  applePay: z.boolean().catch(true),
  googlePay: z.boolean().catch(true),
  savedCards: z.boolean().catch(true),
  buyNowButton: z.boolean().catch(true),
  stickyAddToCart: z.boolean().catch(true),
  whatsappShare: z.boolean().catch(true),
  barcodeScan: z.boolean().catch(true),
  voiceSearch: z.boolean().catch(true),
  appOnlyDiscountEnabled: z.boolean().catch(false),
  appOnlyDiscountCode: safeText(24, "MOBIL10"),
  appOnlyDiscountPercent: z.number().min(0).max(90).catch(10),
});

const publishingSchema = z.object({
  iosBundleId: safeText(120),
  androidPackage: safeText(120),
  appStoreUrl: safeText(300),
  playStoreUrl: safeText(300),
  versionName: safeText(20, "1.0.0"),
  buildNumber: z.number().int().min(1).max(99999).catch(1),
  releaseNotes: safeText(600),
  channel: z.enum(["internal", "beta", "production"]).catch("internal"),
});

export const mobileAppConfigSchema = z.object({
  schemaVersion: z.literal(1).catch(1),
  branding: brandingSchema.catch({} as never),
  navigation: navigationSchema.catch({} as never),
  commerce: commerceSchema.catch({} as never),
  publishing: publishingSchema.catch({} as never),
  home: z.array(widgetSchema).max(30).catch([]),
});

export type MobileAppConfig = z.infer<typeof mobileAppConfigSchema>;

/* ------------------------------------------------------------------ */
/* Varsayılanlar                                                       */
/* ------------------------------------------------------------------ */

let widgetSeq = 0;
/** Yeni widget kimliği (SSR güvenli: rastgelelik yok). */
export function nextWidgetId(type: string): string {
  widgetSeq += 1;
  return `${type}-${Date.now().toString(36)}-${widgetSeq}`;
}

export function defaultWidget(type: MobileWidgetType): MobileWidget {
  const base: MobileWidget = {
    id: nextWidgetId(type),
    type,
    visible: true,
    title: "",
    subtitle: "",
    imageUrl: "",
    link: "",
    columns: 2,
    limit: 6,
    autoplay: true,
    endsAt: "",
    items: [],
  };
  switch (type) {
    case "announcement_ticker":
      return { ...base, title: "500 TL üzeri kargo bedava · Uygulamaya özel %10 indirim" };
    case "search_bar":
      return { ...base, title: "Ürün, kategori veya marka ara" };
    case "stories":
      return {
        ...base,
        title: "Hikayeler",
        items: [
          { id: "s1", label: "Yeni Sezon", imageUrl: "", link: buildDeepLink("collection", "yeni-sezon") },
          { id: "s2", label: "İndirim", imageUrl: "", link: buildDeepLink("collection", "indirim") },
          { id: "s3", label: "Çok Satan", imageUrl: "", link: buildDeepLink("collection", "cok-satan") },
        ],
      };
    case "hero_carousel":
      return {
        ...base,
        title: "Kampanyalar",
        items: [
          { id: "h1", label: "Yeni sezon indirimleri", imageUrl: "", link: buildDeepLink("collection", "yeni-sezon") },
          { id: "h2", label: "Sepette ekstra %15", imageUrl: "", link: buildDeepLink("collection", "kampanya") },
        ],
      };
    case "category_circles":
      return { ...base, title: "Kategoriler", limit: 8 };
    case "flash_sale":
      return { ...base, title: "Flash İndirim", subtitle: "Sınırlı süre!", limit: 6, columns: 2 };
    case "product_grid":
      return { ...base, title: "Çok satanlar", limit: 6, columns: 2 };
    case "lookbook":
      return { ...base, title: "Lookbook", subtitle: "Görsele dokun, ürüne git" };
    case "banner":
      return { ...base, title: "Uygulamaya özel fırsat", link: buildDeepLink("collection", "kampanya") };
    default:
      return { ...base, title: "Mağazamız hakkında", subtitle: "Hızlı teslimat, güvenli ödeme, kolay iade." };
  }
}

export function defaultMobileAppConfig(storeName = "Mağazam"): MobileAppConfig {
  return {
    schemaVersion: 1,
    branding: {
      appName: storeName.slice(0, 40),
      tagline: "Mobil alışverişin en hızlı hali",
      description: `${storeName} resmi mobil uygulaması: yeni sezon ürünleri, uygulamaya özel indirimler ve hızlı teslimat.`,
      primary: "#111111",
      accent: "#f04f36",
      background: "#ffffff",
      surface: "#f6f6f7",
      text: "#111111",
      headingFont: "Geist",
      radius: 14,
      appIconUrl: "",
      splashImageUrl: "",
      splashBackground: "#111111",
      darkMode: false,
    },
    navigation: {
      showDrawer: true,
      tabs: TAB_KEYS.map((key) => ({ key, label: TAB_LABELS[key], visible: key !== "search" ? true : true })),
      drawer: [
        { id: "d1", label: "Tüm ürünler", link: buildDeepLink("collection", "") },
        { id: "d2", label: "Kampanyalar", link: buildDeepLink("collection", "kampanya") },
        { id: "d3", label: "Siparişlerim", link: buildDeepLink("account", "") },
      ],
    },
    commerce: {
      applePay: true,
      googlePay: true,
      savedCards: true,
      buyNowButton: true,
      stickyAddToCart: true,
      whatsappShare: true,
      barcodeScan: true,
      voiceSearch: true,
      appOnlyDiscountEnabled: false,
      appOnlyDiscountCode: "MOBIL10",
      appOnlyDiscountPercent: 10,
    },
    publishing: {
      iosBundleId: "",
      androidPackage: "",
      appStoreUrl: "",
      playStoreUrl: "",
      versionName: "1.0.0",
      buildNumber: 1,
      releaseNotes: "",
      channel: "internal",
    },
    home: [
      defaultWidget("announcement_ticker"),
      defaultWidget("search_bar"),
      defaultWidget("stories"),
      defaultWidget("hero_carousel"),
      defaultWidget("category_circles"),
      defaultWidget("flash_sale"),
      defaultWidget("product_grid"),
    ],
  };
}

/** Kaydedilmiş/gelen JSON'u güvenli ve tam bir yapıya dönüştürür. */
export function resolveMobileAppConfig(raw: unknown, storeName?: string): MobileAppConfig {
  const fallback = defaultMobileAppConfig(storeName);
  if (!raw || typeof raw !== "object") return fallback;
  const parsed = mobileAppConfigSchema.safeParse(raw);
  const value = parsed.success ? parsed.data : fallback;
  const tabs = value.navigation.tabs.length ? value.navigation.tabs : fallback.navigation.tabs;
  return {
    ...fallback,
    ...value,
    branding: { ...fallback.branding, ...value.branding },
    commerce: { ...fallback.commerce, ...value.commerce },
    publishing: { ...fallback.publishing, ...value.publishing },
    navigation: { ...fallback.navigation, ...value.navigation, tabs },
    home: value.home.length ? value.home : fallback.home,
  };
}

/* ------------------------------------------------------------------ */
/* Push otomasyonları                                                  */
/* ------------------------------------------------------------------ */

export const PUSH_TRIGGERS = [
  "welcome",
  "abandoned_cart_1h",
  "abandoned_cart_24h",
  "order_shipped",
  "order_delivered",
  "price_drop",
  "back_in_stock",
] as const;

export type PushTrigger = (typeof PUSH_TRIGGERS)[number];

export const PUSH_TRIGGER_META: Record<
  PushTrigger,
  { label: string; description: string; delayMinutes: number; title: string; body: string; link: string }
> = {
  welcome: {
    label: "Hoş geldin",
    description: "Uygulamayı ilk açan kullanıcıya karşılama bildirimi.",
    delayMinutes: 30,
    title: "Hoş geldin! 🎉",
    body: "Uygulamaya özel indirimleri keşfet.",
    link: buildDeepLink("collection", "kampanya"),
  },
  abandoned_cart_1h: {
    label: "Terk edilmiş sepet — 1. saat",
    description: "Sepette ürün bırakan kullanıcıya 1 saat sonra hatırlatma.",
    delayMinutes: 60,
    title: "Sepetin seni bekliyor 🛒",
    body: "Ürünler tükenmeden siparişini tamamla.",
    link: buildDeepLink("cart", ""),
  },
  abandoned_cart_24h: {
    label: "Terk edilmiş sepet — 24. saat",
    description: "24 saat sonra indirim kodlu ikinci hatırlatma.",
    delayMinutes: 1440,
    title: "Sadece bugün: sepetine %10 indirim",
    body: "SEPET10 kodu ile siparişini tamamla.",
    link: buildDeepLink("cart", ""),
  },
  order_shipped: {
    label: "Kargoya verildi",
    description: "Sipariş kargoya verildiğinde otomatik bildirim.",
    delayMinutes: 0,
    title: "Siparişin kargoya verildi 🚚",
    body: "Kargo takip bilgilerini uygulamadan görebilirsin.",
    link: buildDeepLink("account", ""),
  },
  order_delivered: {
    label: "Teslim edildi",
    description: "Teslimat sonrası değerlendirme daveti.",
    delayMinutes: 0,
    title: "Siparişin teslim edildi 📦",
    body: "Ürünü değerlendirerek diğer müşterilere yardımcı ol.",
    link: buildDeepLink("account", ""),
  },
  price_drop: {
    label: "Fiyat düşüşü",
    description: "Favorilere eklenen ürünün fiyatı düştüğünde.",
    delayMinutes: 0,
    title: "Favorindeki ürünün fiyatı düştü 📉",
    body: "Fırsatı kaçırmadan incele.",
    link: buildDeepLink("account", ""),
  },
  back_in_stock: {
    label: "Stoğa girdi",
    description: "Tükenen ürün yeniden stoğa girdiğinde.",
    delayMinutes: 0,
    title: "Beklediğin ürün stoklarda! ✅",
    body: "Tükenmeden hemen sipariş ver.",
    link: buildDeepLink("account", ""),
  },
};

export const PUSH_AUDIENCES = ["all", "ios", "android", "customers", "abandoned_cart"] as const;
export type PushAudience = (typeof PUSH_AUDIENCES)[number];

export const PUSH_AUDIENCE_LABELS: Record<PushAudience, string> = {
  all: "Tüm uygulama kullanıcıları",
  ios: "Yalnızca iOS",
  android: "Yalnızca Android",
  customers: "Kayıtlı müşteriler",
  abandoned_cart: "Sepetini terk edenler",
};
