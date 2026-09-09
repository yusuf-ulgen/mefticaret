import {
  Activity,
  BadgeCheck,
  Bell,
  Blocks,
  ChartNoAxesColumn,
  Coins,
  CreditCard,
  FileText,
  Gauge,
  Globe,
  History,
  Images,
  LayoutTemplate,
  LifeBuoy,
  Megaphone,
  MousePointerClick,
  Palette,
  PenLine,
  Radio,
  Receipt,
  ScrollText,
  Search,
  ShieldAlert,
  ShieldCheck,
  Store,
  Tag,
  Terminal,
  Ticket,
  Users,
  Wallet,
  Webhook,
} from "lucide-react";

/** Süper admin mega menüsünün tek kaynağı: gruplar, bağlantılar ve arama anahtar kelimeleri. */

export type AdminNavItem = {
  to: string;
  label: string;
  icon: typeof Store;
  hint?: string;
  keywords?: string;
};

export type AdminNavGroup = {
  title: string;
  description: string;
  items: AdminNavItem[];
};

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    title: "Genel bakış",
    description: "Platformun nabzı ve anlık trafik.",
    items: [
      { to: "/admin", label: "Dashboard", icon: Gauge, hint: "Platform özeti", keywords: "panel özet kpi" },
      { to: "/admin/live", label: "Canlı İzleme", icon: Radio, hint: "Anlık trafik", keywords: "gerçek zamanlı ziyaretçi" },
      { to: "/admin/analytics", label: "Analitik", icon: ChartNoAxesColumn, hint: "Rapor ve trendler", keywords: "analitik rapor" },
    ],
  },
  {
    title: "Mağazalar & kullanıcılar",
    description: "Kiracılar, hesaplar ve satıcılar.",
    items: [
      { to: "/admin/stores", label: "Mağazalar", icon: Store, hint: "Oluştur, düzenle, sil", keywords: "tenant store crud" },
      { to: "/admin/users", label: "Kullanıcılar", icon: Users, hint: "Hesaplar ve roller", keywords: "profil rol" },
      { to: "/admin/sellers", label: "Satıcılar", icon: BadgeCheck, hint: "Marketplace satıcıları", keywords: "seller onay" },
    ],
  },
  {
    title: "Ön uç & içerik",
    description: "Mağaza tasarımı, metinler, sayfalar ve blog sistemi.",
    items: [
      {
        to: "/admin/frontend",
        label: "Ön Uç Yönetimi",
        icon: LayoutTemplate,
        hint: "Mağaza vitrinini düzenle",
        keywords: "vitrin tasarım hero bölüm section storefront ön uç",
      },
      {
        to: "/admin/frontend/landing",
        label: "Ana Sayfa (Landing)",
        icon: LayoutTemplate,
        hint: "Platform ana sayfası bölümleri",
        keywords: "ana sayfa landing hero bölüm menü footer sss blog fiyat",
      },
      { to: "/admin/themes", label: "Temalar", icon: Palette, hint: "Tema kütüphanesi", keywords: "tema şablon renk" },
      { to: "/admin/cms", label: "Sayfalar (CMS)", icon: FileText, hint: "Kurumsal sayfalar", keywords: "hakkımızda iletişim sayfa metin" },
      { to: "/admin/blog", label: "Blog Sistemi", icon: PenLine, hint: "Yazılar ve yayın takvimi", keywords: "makale içerik yazı" },
      { to: "/admin/content", label: "İçerik Merkezi", icon: Images, hint: "Popup, story, medya", keywords: "popup hikaye medya banner duyuru" },
      { to: "/admin/languages", label: "Dil ve Çeviri", icon: Globe, hint: "Çok dilli mağazalar", keywords: "dil çeviri translation locale hreflang" },
    ],
  },
  {
    title: "SEO",
    description: "Arama görünürlüğü ve otomatik optimizasyon.",
    items: [
      { to: "/admin/seo", label: "SEO Merkezi", icon: Search, hint: "Meta, yönlendirme, 404", keywords: "seo meta redirect sitemap" },
      {
        to: "/admin/seo-ai",
        label: "Otomatik SEO AI",
        icon: Search,
        hint: "Her gün otomatik SEO çalışması",
        keywords: "seo yapay zeka otomatik günlük meta optimizasyon",
      },
    ],
  },
  {
    title: "Paketler & gelir",
    description: "Paket limitleri, abonelik, ödeme ve komisyon akışı.",
    items: [
      { to: "/admin/plans", label: "Paketler", icon: CreditCard, hint: "Fiyat ve limitler", keywords: "fiyat paket limit plan aylık yıllık" },
      { to: "/admin/subscriptions", label: "Abonelikler", icon: Receipt, hint: "Mağaza abonelikleri", keywords: "plan abonelik yenileme" },
      { to: "/admin/coupons", label: "Kuponlar", icon: Tag, hint: "Kampanya kodları", keywords: "indirim kupon" },
      {
        to: "/admin/billing",
        label: "Ödeme & Tahsilat",
        icon: Receipt,
        hint: "Ödeal bağlantısı ve faturalar",
        keywords: "ödeal fatura tahsilat ödeme linki kart sağlayıcı",
      },
      { to: "/admin/payments", label: "Ödemeler", icon: Wallet, hint: "Tahsilat ve ödeme", keywords: "tahsilat ödeme" },
      { to: "/admin/transactions", label: "İşlemler", icon: Coins, hint: "Muhasebe hareketleri", keywords: "hareket işlem" },
      { to: "/admin/commissions", label: "Komisyonlar", icon: Activity, hint: "Satıcı komisyonları", keywords: "komisyon satıcı" },
      { to: "/admin/finance", label: "Finans Merkezi", icon: Wallet, hint: "Ciro ve bakiye", keywords: "finans ciro" },
    ],
  },
  {
    title: "Entegrasyonlar",
    description: "Uygulama mağazası, pazaryerleri, API ve webhook.",
    items: [
      { to: "/admin/apps", label: "Uygulamalar", icon: Blocks, hint: "Uygulama mağazası", keywords: "app store entegrasyon kategori" },
      { to: "/admin/marketplace", label: "Pazaryerleri", icon: Globe, hint: "Kanal bağlantıları", keywords: "trendyol hepsiburada kanal pazaryeri" },
      { to: "/admin/api", label: "API Anahtarları", icon: Terminal, hint: "Erişim anahtarları", keywords: "api anahtar token" },
      { to: "/admin/webhooks", label: "Webhook", icon: Webhook, hint: "Olay bildirimleri", keywords: "webhook olay" },
      { to: "/admin/notifications", label: "Bildirimler", icon: Bell, hint: "Bildirim akışı", keywords: "bildirim" },
      { to: "/admin/push", label: "Push Bildirimleri", icon: Megaphone, hint: "Firebase mobil duyuru", keywords: "push firebase fcm mobil bildirim duyuru" },
    ],
  },
  {
    title: "Destek",
    description: "Müşteri ve mağaza destek operasyonu.",
    items: [
      { to: "/admin/support", label: "Destek Merkezi", icon: LifeBuoy, keywords: "destek" },
      { to: "/admin/tickets", label: "Ticket", icon: Ticket, keywords: "talep ticket" },
    ],
  },
  {
    title: "Loglar & denetim",
    description: "Denetim kayıtları, güvenlik olayları ve sistem durumu.",
    items: [
      { to: "/admin/logs", label: "Log Merkezi", icon: ScrollText, hint: "Tüm loglar tek ekranda", keywords: "log kayıt denetim güvenlik" },
      { to: "/admin/audit", label: "Audit Logs", icon: History, hint: "İşlem geçmişi", keywords: "denetim log" },
      { to: "/admin/security", label: "Güvenlik Olayları", icon: ShieldAlert, hint: "Şüpheli hareketler", keywords: "güvenlik olay" },
      { to: "/admin/system", label: "Sistem Durumu", icon: Activity, hint: "Kuyruk ve sağlık", keywords: "sağlık durum kuyruk" },
    ],
  },
  {
    title: "Ayarlar",
    description: "Platform genelinde yapılandırma.",
    items: [
      { to: "/admin/settings", label: "Sistem Ayarları", icon: ShieldCheck, keywords: "ayar konfig" },
    ],
  },
];

/** Mega menü aramasında kullanılan düz liste. */
export const ADMIN_NAV_FLAT: (AdminNavItem & { group: string })[] = ADMIN_NAV.flatMap((group) =>
  group.items.map((item) => ({ ...item, group: group.title })),
);

export function filterAdminNav(term: string): AdminNavGroup[] {
  const needle = term.trim().toLocaleLowerCase("tr");
  if (!needle) return ADMIN_NAV;
  return ADMIN_NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      `${item.label} ${item.hint ?? ""} ${item.keywords ?? ""} ${group.title}`
        .toLocaleLowerCase("tr")
        .includes(needle),
    ),
  })).filter((group) => group.items.length > 0);
}

export const ADMIN_QUICK_ACTIONS: AdminNavItem[] = [
  { to: "/admin/frontend", label: "Ön uç düzenle", icon: LayoutTemplate },
  { to: "/admin/frontend/landing", label: "Ana sayfa", icon: LayoutTemplate },
  { to: "/admin/blog", label: "Blog", icon: PenLine },
  { to: "/admin/stores", label: "Mağazalar", icon: Store },
  { to: "/admin/live", label: "Canlı", icon: MousePointerClick },
];
