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
  MousePointerClick,
  Palette,
  PenLine,
  Radio,
  Receipt,
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
    title: "Genel",
    description: "Platformun nabzı, mağazalar ve kullanıcılar.",
    items: [
      { to: "/admin", label: "Dashboard", icon: Gauge, hint: "Platform özeti", keywords: "panel özet kpi" },
      { to: "/admin/live", label: "Canlı İzleme", icon: Radio, hint: "Anlık trafik", keywords: "gerçek zamanlı ziyaretçi" },
      { to: "/admin/stores", label: "Mağazalar", icon: Store, hint: "Oluştur, düzenle, sil", keywords: "tenant store crud" },
      { to: "/admin/users", label: "Kullanıcılar", icon: Users, hint: "Hesaplar ve roller", keywords: "profil rol" },
      { to: "/admin/sellers", label: "Satıcılar", icon: BadgeCheck, hint: "Marketplace satıcıları", keywords: "seller onay" },
      { to: "/admin/marketplace", label: "Marketplace", icon: Globe, hint: "Kanallar", keywords: "trendyol hepsiburada kanal" },
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
      { to: "/admin/themes", label: "Temalar", icon: Palette, hint: "Tema kütüphanesi", keywords: "tema şablon renk" },
      { to: "/admin/cms", label: "Sayfalar (CMS)", icon: FileText, hint: "Kurumsal sayfalar", keywords: "hakkımızda iletişim sayfa metin" },
      { to: "/admin/blog", label: "Blog Sistemi", icon: PenLine, hint: "Yazılar ve yayın takvimi", keywords: "makale içerik yazı" },
      { to: "/admin/content", label: "İçerik Merkezi", icon: Images, hint: "Popup, story, medya", keywords: "popup hikaye medya banner duyuru" },
      { to: "/admin/seo", label: "SEO Merkezi", icon: Search, hint: "Meta, yönlendirme, 404", keywords: "seo meta redirect sitemap" },
      { to: "/admin/coupons", label: "Kuponlar", icon: Tag, hint: "Kampanya kodları", keywords: "indirim kupon" },
    ],
  },
  {
    title: "Gelir",
    description: "Abonelik, ödeme ve komisyon akışı.",
    items: [
      { to: "/admin/subscriptions", label: "Abonelikler", icon: Receipt, keywords: "plan abonelik" },
      { to: "/admin/plans", label: "Paketler", icon: CreditCard, keywords: "fiyat paket limit" },
      { to: "/admin/payments", label: "Ödemeler", icon: Wallet, keywords: "tahsilat ödeme" },
      { to: "/admin/transactions", label: "İşlemler", icon: Coins, keywords: "hareket işlem" },
      { to: "/admin/commissions", label: "Komisyonlar", icon: Activity, keywords: "komisyon satıcı" },
      { to: "/admin/finance", label: "Finans Merkezi", icon: Wallet, keywords: "finans ciro" },
    ],
  },
  {
    title: "Ekosistem",
    description: "Uygulamalar, API ve entegrasyonlar.",
    items: [
      { to: "/admin/apps", label: "Uygulamalar", icon: Blocks, keywords: "app store entegrasyon" },
      { to: "/admin/api", label: "API", icon: Terminal, keywords: "api anahtar" },
      { to: "/admin/webhooks", label: "Webhook", icon: Webhook, keywords: "webhook olay" },
      { to: "/admin/notifications", label: "Bildirimler", icon: Bell, keywords: "bildirim" },
    ],
  },
  {
    title: "Destek",
    description: "Müşteri ve mağaza destek operasyonu.",
    items: [
      { to: "/admin/support", label: "Destek", icon: LifeBuoy, keywords: "destek" },
      { to: "/admin/tickets", label: "Ticket", icon: Ticket, keywords: "talep ticket" },
    ],
  },
  {
    title: "Sistem",
    description: "Analitik, ayarlar, güvenlik ve denetim.",
    items: [
      { to: "/admin/analytics", label: "Analitik", icon: ChartNoAxesColumn, keywords: "analitik rapor" },
      { to: "/admin/system", label: "Sistem Durumu", icon: Activity, keywords: "sağlık durum kuyruk" },
      { to: "/admin/settings", label: "Sistem Ayarları", icon: ShieldCheck, keywords: "ayar konfig" },
      { to: "/admin/security", label: "Güvenlik", icon: ShieldAlert, keywords: "güvenlik olay" },
      { to: "/admin/audit", label: "Audit Logs", icon: History, keywords: "denetim log" },
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
  { to: "/admin/blog", label: "Blog", icon: PenLine },
  { to: "/admin/stores", label: "Mağazalar", icon: Store },
  { to: "/admin/live", label: "Canlı", icon: MousePointerClick },
];
