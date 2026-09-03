import {
  Banknote,
  Barcode,
  Bell,
  BellRing,
  Blocks,
  Bot,
  Boxes,
  Building2,
  ArrowLeftRight,
  BadgeCheck,
  ChartNoAxesColumn,
  ClipboardList,
  Cog,
  Coins,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Gift,
  Globe,
  Grid3x3,
  HelpCircle,
  History,
  Images,
  KeyRound,
  Layers,
  LayoutDashboard,
  MapPin,
  Megaphone,
  Menu,
  MessageCircle,
  MessageSquare,
  Package,
  PackageSearch,
  Palette,
  PenLine,
  Radio,
  Receipt,
  RefreshCcw,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Star,
  Store,
  Tag,
  Tags,
  Timer,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
  UsersRound,
  Wallet,
  Wand2,
  Warehouse,
  Webhook,
  Zap,
} from "lucide-react";

export type StoreNavItem = {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Ek arama anahtarları (Türkçe/İngilizce eşanlamlılar). */
  keywords?: string;
};

export type StoreNavGroup = {
  group: string;
  icon: React.ComponentType<{ className?: string }>;
  items: StoreNavItem[];
};

/** Satıcı panelinin ana menüsü — konuya göre gruplanmış ve daraltılabilir. */
export function storeNavGroups(storeId: string): StoreNavGroup[] {
  const p = (path: string) => `/store/${storeId}/${path}`;
  return [
    {
      group: "Genel",
      icon: LayoutDashboard,
      items: [
        { label: "Panel", to: p("dashboard"), icon: LayoutDashboard, keywords: "dashboard özet" },
        { label: "Canlı İzleme", to: p("live"), icon: Radio, keywords: "live gerçek zamanlı" },
        { label: "Operasyon Merkezi", to: p("tasks"), icon: ClipboardList, keywords: "görev" },
        { label: "Bildirimler", to: p("notifications"), icon: Bell },
        { label: "Yayına Hazırlık", to: p("health"), icon: ShieldCheck, keywords: "kontrol" },
        { label: "Kuyruk & Önbellek", to: p("jobs"), icon: Timer, keywords: "queue cache" },
      ],
    },
    {
      group: "Katalog",
      icon: Package,
      items: [
        { label: "Ürünler", to: p("products"), icon: Package, keywords: "product varyant" },
        { label: "Koleksiyonlar", to: p("collections"), icon: Boxes, keywords: "kategori" },
        { label: "Medya", to: p("media"), icon: Images, keywords: "görsel resim" },
        { label: "Fiyatlandırma", to: p("pricing"), icon: Tags },
        { label: "Barkod Etiketi", to: p("barcodes"), icon: Barcode },
        { label: "İçe / Dışa Aktarma", to: p("import-export"), icon: FileSpreadsheet, keywords: "csv" },
      ],
    },
    {
      group: "Envanter",
      icon: Warehouse,
      items: [
        { label: "Stok", to: p("inventory"), icon: Warehouse },
        { label: "Depolar & Şubeler", to: p("warehouses"), icon: Building2 },
        { label: "Depo Transferleri", to: p("transfers"), icon: ArrowLeftRight },
        { label: "Stok Sayımı", to: p("stock-count"), icon: ClipboardList },
        { label: "Tedarik & Satın Alma", to: p("purchasing"), icon: Truck },
        { label: "Dropshipping & XML", to: p("dropshipping"), icon: Truck },
        { label: "Yeniden Sipariş", to: p("reorder"), icon: RefreshCcw },
        { label: "Stok Tükenme Radarı", to: p("stockout"), icon: Timer },
        { label: "Stok Bildirimleri", to: p("stock-alerts"), icon: BellRing },
        { label: "Envanter Değerleme", to: p("valuation"), icon: Coins },
        { label: "Stok Yaşlandırma", to: p("aging"), icon: Timer },
      ],
    },
    {
      group: "Siparişler",
      icon: ShoppingBag,
      items: [
        { label: "Siparişler", to: p("orders"), icon: ShoppingBag },
        { label: "Sevkiyatlar", to: p("shipments"), icon: Truck, keywords: "kargo" },
        { label: "İadeler", to: p("returns"), icon: RotateCcw },
        { label: "Terk Sepetler", to: p("carts"), icon: ShoppingCart, keywords: "abandoned" },
        { label: "Karşılama SLA", to: p("sla"), icon: Timer },
        { label: "İptal & Kayıp", to: p("losses"), icon: TrendingDown },
      ],
    },
    {
      group: "Müşteriler",
      icon: Users,
      items: [
        { label: "Müşteriler", to: p("customers"), icon: Users },
        { label: "Segmentler", to: p("segments"), icon: UsersRound },
        { label: "Müşteri Segmentleri", to: p("customer-segments"), icon: Users },
        { label: "Değerlendirmeler", to: p("reviews"), icon: Star, keywords: "yorum" },
        { label: "Soru & Cevap", to: p("questions"), icon: HelpCircle },
        { label: "Destek Talepleri", to: p("support"), icon: MessageSquare, keywords: "ticket" },
        { label: "Mesaj Merkezi", to: p("inbox"), icon: MessageCircle, keywords: "inbox omni instagram telegram sohbet" },
      ],
    },
    {
      group: "Pazarlama",
      icon: Megaphone,
      items: [
        { label: "Pazarlama", to: p("marketing"), icon: Megaphone },
        { label: "Pazarlama Otomasyonu", to: p("automations"), icon: Zap },
        { label: "İndirimler", to: p("discounts"), icon: Tag, keywords: "kupon" },
        { label: "Hediye Kartları", to: p("gift-cards"), icon: Gift },
        { label: "WhatsApp", to: p("whatsapp"), icon: MessageCircle },
        { label: "SEO Denetimi", to: p("seo"), icon: Search },
        { label: "SEO Editörü", to: p("seo-editor"), icon: Search },
        { label: "Pazaryerleri", to: p("channels"), icon: Store },
        { label: "Pazaryeri Satıcıları", to: p("sellers"), icon: Users },
        { label: "Pazaryeri İadeleri", to: p("marketplace-returns"), icon: RotateCcw, keywords: "iade değişim trendyol" },
        { label: "Mutabakat & Hakediş", to: p("settlements"), icon: Receipt, keywords: "settlement komisyon" },
        { label: "Pazaryeri Analitiği", to: p("marketplace-analytics"), icon: ChartNoAxesColumn, keywords: "stok tükenme sipariş ürün analizi" },
        { label: "Çoklu İlan Bağlantıları", to: p("listing-links"), icon: Layers, keywords: "listing ilan eşleştirme" },
        { label: "Popup & Duyuru", to: p("popups"), icon: Sparkles, keywords: "popup animasyon" },
        { label: "Sosyal Paylaşım", to: p("social-share"), icon: Megaphone, keywords: "story instagram paylaş" },
        { label: "Ürün Akışları", to: p("feeds"), icon: FileSpreadsheet, keywords: "google shopping tiktok katalog feed" },
      ],
    },
    {
      group: "Vitrin & Tema",
      icon: Palette,
      items: [
        { label: "Tema", to: p("theme-editor"), icon: Palette, keywords: "tema düzenleyici şablon blok bileşen vitrin" },
        { label: "Vitrin Menüleri", to: p("navigation"), icon: Menu },
        { label: "İçerik Sayfaları", to: p("pages"), icon: FileText },
        { label: "Blog & CMS", to: p("blog"), icon: PenLine },
        { label: "Domainler", to: p("domains"), icon: Globe },
      ],
    },
    {
      group: "Finans",
      icon: Wallet,
      items: [
        { label: "Finans", to: p("finance"), icon: Wallet },
        { label: "Finansal Defter", to: p("ledger"), icon: Wallet },
        { label: "Nakit Akışı", to: p("cashflow"), icon: Wallet },
        { label: "Tahsilat Takibi", to: p("receivables"), icon: Banknote },
        { label: "Kârlılık", to: p("profit"), icon: Coins },
        { label: "KDV Raporu", to: p("tax"), icon: Receipt },
        { label: "Hediye Kartı Yükümlülüğü", to: p("gift-liability"), icon: Wallet },
        { label: "Abonelik", to: p("billing"), icon: CreditCard, keywords: "plan fatura" },
      ],
    },
    {
      group: "Analitik & Raporlar",
      icon: ChartNoAxesColumn,
      items: [
        { label: "Analitik", to: p("analytics"), icon: ChartNoAxesColumn },
        { label: "Ciro Tahmini", to: p("forecast"), icon: TrendingUp },
        { label: "Kohortlar", to: p("cohorts"), icon: Grid3x3 },
        { label: "Ürün Raporu", to: p("reports"), icon: PackageSearch },
        { label: "Dönüşüm Hunisi", to: p("funnel"), icon: ShoppingCart },
        { label: "Sepet Analizi", to: p("basket"), icon: ShoppingCart },
        { label: "Coğrafi Dağılım", to: p("geo"), icon: MapPin },
        { label: "Müşteri LTV", to: p("ltv"), icon: UsersRound },
        { label: "Tekrar Satın Alma", to: p("repurchase"), icon: RefreshCcw },
        { label: "İade Analizi", to: p("returns-analytics"), icon: RotateCcw },
        { label: "Kampanya Performansı", to: p("campaigns"), icon: Tag },
        { label: "İndirim Derinliği", to: p("elasticity"), icon: Tag },
        { label: "Ürün Yaşam Döngüsü", to: p("lifecycle"), icon: Tag },
        { label: "Değerlendirme Etkisi", to: p("review-impact"), icon: Tag },
        { label: "ABC & Devir Hızı", to: p("abc"), icon: Layers },
        { label: "Marka Performansı", to: p("vendors"), icon: Layers },
        { label: "Kargo Performansı", to: p("shipping-performance"), icon: Truck },
        { label: "Kargo Ekonomisi", to: p("shipping-economics"), icon: Truck },
        { label: "Tedarikçi Performansı", to: p("supplier-performance"), icon: Truck },
        { label: "İletişim Performansı", to: p("support-performance"), icon: HelpCircle },
        { label: "Personel Performansı", to: p("team-performance"), icon: ShieldCheck },
        { label: "Senaryo Simülatörü", to: p("simulator"), icon: Tag },
        { label: "Aylık Rapor", to: p("report-monthly"), icon: FileText },
      ],
    },
    {
      group: "Yapay Zekâ",
      icon: Sparkles,
      items: [
        { label: "Copilot", to: p("copilot"), icon: Bot },
        { label: "AI Asistan", to: p("ai"), icon: Sparkles },
      ],
    },
    {
      group: "Ayarlar",
      icon: Cog,
      items: [
        { label: "Ayarlar", to: p("settings"), icon: Cog },
        { label: "Ödeme", to: p("payments"), icon: BadgeCheck },
        { label: "Kargo", to: p("shipping"), icon: Truck },
        { label: "Dil & Para Birimi", to: p("localization"), icon: Globe },
        { label: "Ekip & Yetkiler", to: p("team"), icon: ShieldCheck },
        { label: "Güvenlik & KVKK", to: p("security"), icon: ShieldCheck },
        { label: "Denetim Kaydı", to: p("activity"), icon: History },
      ],
    },
    {
      group: "Geliştirici",
      icon: KeyRound,
      items: [
        { label: "Uygulama Mağazası", to: p("apps"), icon: Blocks },
        { label: "API Anahtarları", to: p("api"), icon: KeyRound },
        { label: "OAuth Uygulamaları", to: p("oauth"), icon: KeyRound },
        { label: "Webhook & Bildirim", to: p("webhooks"), icon: Webhook },
      ],
    },
  ];
}

/** Panel üstünde gösterilen hızlı erişim kısayolları. */
export function storeQuickLinks(storeId: string): StoreNavItem[] {
  const p = (path: string) => `/store/${storeId}/${path}`;
  return [
    { label: "Panel", to: p("dashboard"), icon: LayoutDashboard },
    { label: "Siparişler", to: p("orders"), icon: ShoppingBag },
    { label: "Ürünler", to: p("products"), icon: Package },
    { label: "Müşteriler", to: p("customers"), icon: Users },
    { label: "Tema", to: p("theme-editor"), icon: Palette, keywords: "tema blok vitrin" },
    { label: "Ayarlar", to: p("settings"), icon: Cog },
  ];
}
