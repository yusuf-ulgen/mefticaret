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
  Mail,
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
  Sparkles,
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
      {
        to: "/admin",
        label: "Dashboard",
        icon: Gauge,
        hint: "Platform özeti",
        keywords: "panel özet kpi",
      },
      {
        to: "/admin/live",
        label: "Canlı İzleme",
        icon: Radio,
        hint: "Anlık trafik",
        keywords: "gerçek zamanlı ziyaretçi",
      },
      {
        to: "/admin/analytics",
        label: "Analitik",
        icon: ChartNoAxesColumn,
        hint: "Rapor ve trendler",
        keywords: "analitik rapor",
      },
    ],
  },
  {
    title: "Mağazalar & kullanıcılar",
    description: "Kiracılar, hesaplar ve satıcılar.",
    items: [
      {
        to: "/admin/stores",
        label: "Mağazalar",
        icon: Store,
        hint: "Oluştur, düzenle, sil",
        keywords: "tenant store crud",
      },
      {
        to: "/admin/kolay",
        label: "Kolay Panel Satıcıları",
        icon: Store,
        hint: "Ev üreticisi mağazaları ve satışları",
        keywords: "kolay panel ev hanımı hanimlari micro satıcı vitrin mikro paket",
      },
      {
        to: "/admin/kolay-defter",
        label: "Kolay Panel Defteri",
        icon: Store,
        hint: "Mağaza bazında satış, komisyon, aktarım",
        keywords: "kolay defter hakediş komisyon aktarım banka iban satış",
      },
      {
        to: "/admin/ev-hanimlari",
        label: "Ev Hanımları İçerikleri",
        icon: Store,
        hint: "Akademi, ambalaj, kategori, şablon",
        keywords: "ev hanımları akademi video ambalaj kategori şablon whatsapp",
      },
      {
        to: "/admin/control",
        label: "Kontrol Merkezi",
        icon: ShieldCheck,
        hint: "Şikayet, hesap askıya alma, ödeme talepleri, AI paketleri",
        keywords: "şikayet rapor moderasyon ban askıya şifre sıfırla ödeme talebi payout iban ai kredi paket",
      },
      {
        to: "/admin/users",
        label: "Kullanıcılar",
        icon: Users,
        hint: "Hesaplar ve roller",
        keywords: "profil rol",
      },
      {
        to: "/admin/sellers",
        label: "Satıcılar",
        icon: BadgeCheck,
        hint: "Marketplace satıcıları",
        keywords: "seller onay",
      },
      {
        to: "/admin/suppliers",
        label: "Tedarikçiler",
        icon: BadgeCheck,
        hint: "Tedarikçi erişimi, siparişler, ödeme talepleri",
        keywords: "tedarikci supplier xml odeme talebi satin alma",
      },
      {
        to: "/admin/store-access",
        label: "Mağaza Yetkilendirme",
        icon: ShieldCheck,
        hint: "Rol, izin ve mağaza sahipliği",
        keywords: "yetki rol izin permission sahip owner devret ekip personel",
      },
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
      {
        to: "/admin/themes",
        label: "Temalar",
        icon: Palette,
        hint: "Tema kütüphanesi",
        keywords: "tema şablon renk",
      },
      {
        to: "/admin/pages",
        label: "Mağaza Sayfaları",
        icon: FileText,
        hint: "Mağaza sayfalarını oluştur ve düzenle",
        keywords: "sayfa ekle mağaza hakkımızda iletişim kvkk sss",
      },
      {
        to: "/admin/policies",
        label: "Platform Politikaları",
        icon: FileText,
        hint: "Sözleşmeler, sürümler ve onay kayıtları",
        keywords: "politika sözleşme kvkk gizlilik çerez sürüm onay",
      },
      {
        to: "/admin/site-pages",
        label: "Platform Sayfaları",
        icon: FileText,
        hint: "Mefticaret kurumsal sayfaları",
        keywords: "platform kurumsal sayfa hakkımızda kvkk gizlilik iletişim şartlar",
      },
      {
        to: "/admin/site-seo",
        label: "SEO Etiketleri",
        icon: FileText,
        hint: "Sayfa bazında meta başlık, açıklama, canonical",
        keywords: "seo meta title description canonical noindex etiket sayfa blog ana sayfa",
      },
      {
        to: "/admin/cms",
        label: "Sayfa Raporu (CMS)",
        icon: FileText,
        hint: "Tüm mağaza sayfaları listesi",
        keywords: "cms liste rapor sayfa",
      },
      {
        to: "/admin/blog",
        label: "Blog Sistemi",
        icon: PenLine,
        hint: "Yazılar ve yayın takvimi",
        keywords: "makale içerik yazı",
      },
      {
        to: "/admin/site-blog",
        label: "Platform Blogu",
        icon: PenLine,
        hint: "Mefticaret'in kendi blog yazıları",
        keywords: "platform blog yazı makale mefticaret kurumsal",
      },
      {
        to: "/admin/messages",
        label: "Gelen Mesajlar",
        icon: Mail,
        hint: "İletişim formu mesajları",
        keywords: "mesaj iletişim form e-posta contact gelen",
      },
      {
        to: "/admin/content",
        label: "İçerik Merkezi",
        icon: Images,
        hint: "Popup, story, medya",
        keywords: "popup hikaye medya banner duyuru",
      },
      {
        to: "/admin/languages",
        label: "Dil ve Çeviri",
        icon: Globe,
        hint: "Çok dilli mağazalar",
        keywords: "dil çeviri translation locale hreflang",
      },
    ],
  },
  {
    title: "SEO",
    description: "Arama görünürlüğü ve otomatik optimizasyon.",
    items: [
      {
        to: "/admin/seo",
        label: "SEO Merkezi",
        icon: Search,
        hint: "Meta, yönlendirme, 404",
        keywords: "seo meta redirect sitemap",
      },
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
      {
        to: "/admin/plans",
        label: "Paketler",
        icon: CreditCard,
        hint: "Fiyat ve limitler",
        keywords: "fiyat paket limit plan aylık yıllık",
      },
      {
        to: "/admin/subscriptions",
        label: "Abonelikler",
        icon: Receipt,
        hint: "Mağaza abonelikleri",
        keywords: "plan abonelik yenileme",
      },
      {
        to: "/admin/coupons",
        label: "Kuponlar",
        icon: Tag,
        hint: "Kampanya kodları",
        keywords: "indirim kupon",
      },
      {
        to: "/admin/billing",
        label: "Ödeme & Tahsilat",
        icon: Receipt,
        hint: "QNBpay tahsilatı ve faturalar",
        keywords: "qnbpay fatura tahsilat ödeme linki kart sağlayıcı",
      },
      {
        to: "/admin/payments",
        label: "Ödemeler",
        icon: Wallet,
        hint: "Tahsilat ve ödeme",
        keywords: "tahsilat ödeme",
      },
      {
        to: "/admin/transactions",
        label: "İşlemler",
        icon: Coins,
        hint: "Muhasebe hareketleri",
        keywords: "hareket işlem",
      },
      {
        to: "/admin/commissions",
        label: "Komisyonlar",
        icon: Activity,
        hint: "Satıcı komisyonları",
        keywords: "komisyon satıcı",
      },
      {
        to: "/admin/finance",
        label: "Finans Merkezi",
        icon: Wallet,
        hint: "Ciro ve bakiye",
        keywords: "finans ciro",
      },
      {
        to: "/admin/qnbpay",
        label: "QNBpay POS",
        icon: CreditCard,
        hint: "Sanal POS, fiyatlar ve tahsilat",
        keywords: "qnbpay pos sanal kart tahsilat taksit komisyon iade webhook ödeme linki fiyat",
      },
      {
        to: "/admin/einvoice",
        label: "E-Fatura (QNB)",
        icon: FileText,
        hint: "QNB eSolutions web servisi",
        keywords: "qnb esolutions e-fatura e-arşiv soap özel entegratör ubl",
      },
    ],
  },
  {
    title: "Entegrasyonlar",
    description: "Uygulama mağazası, pazaryerleri, API ve webhook.",
    items: [
      {
        to: "/admin/apps",
        label: "Uygulamalar",
        icon: Blocks,
        hint: "Uygulama mağazası",
        keywords: "app store entegrasyon kategori",
      },
      {
        to: "/admin/email-marketing",
        label: "E-posta Pazarlama",
        icon: Blocks,
        hint: "Satıcılara kampanya, mağaza kampanyaları",
        keywords: "email e-posta pazarlama kampanya bülten satıcı",
      },
      {
        to: "/admin/marketplace",
        label: "Pazaryerleri",
        icon: Globe,
        hint: "Kanal bağlantıları",
        keywords: "trendyol hepsiburada kanal pazaryeri",
      },
      {
        to: "/admin/api",
        label: "API Anahtarları",
        icon: Terminal,
        hint: "Erişim anahtarları",
        keywords: "api anahtar token",
      },
      {
        to: "/admin/webhooks",
        label: "Webhook",
        icon: Webhook,
        hint: "Olay bildirimleri",
        keywords: "webhook olay",
      },
      {
        to: "/admin/notifications",
        label: "Bildirimler",
        icon: Bell,
        hint: "Bildirim akışı",
        keywords: "bildirim",
      },
      {
        to: "/admin/push",
        label: "Push Bildirimleri",
        icon: Megaphone,
        hint: "Firebase mobil duyuru",
        keywords: "push firebase fcm mobil bildirim duyuru",
      },
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
      {
        to: "/admin/logs",
        label: "Log Merkezi",
        icon: ScrollText,
        hint: "Tüm loglar tek ekranda",
        keywords: "log kayıt denetim güvenlik",
      },
      {
        to: "/admin/audit",
        label: "Audit Logs",
        icon: History,
        hint: "İşlem geçmişi",
        keywords: "denetim log",
      },
      {
        to: "/admin/security",
        label: "Güvenlik Olayları",
        icon: ShieldAlert,
        hint: "Şüpheli hareketler",
        keywords: "güvenlik olay",
      },
      {
        to: "/admin/firewall",
        label: "DDoS & Güvenlik Duvarı",
        icon: ShieldAlert,
        hint: "IP, ülke, ASN, hız limiti",
        keywords: "ddos firewall ip ülke asn captcha",
      },
      {
        to: "/admin/system",
        label: "Sistem Durumu",
        icon: Activity,
        hint: "Kuyruk ve sağlık",
        keywords: "sağlık durum kuyruk",
      },
      {
        to: "/admin/load-test",
        label: "Yük Testi Monitörü",
        icon: Activity,
        hint: "Otomatik stres testi turları",
        keywords: "yük test stres k6 simülasyon",
      },
    ],
  },
  {
    title: "Ayarlar",
    description: "Platform genelinde yapılandırma.",
    items: [
      {
        to: "/admin/settings",
        label: "Sistem Ayarları",
        icon: ShieldCheck,
        keywords: "ayar konfig",
      },
      {
        to: "/admin/settings/ai-engine",
        label: "AI Motor Masası",
        icon: Sparkles,
        hint: "OpenAI yönlendirme ve kredi ekonomisi",
        keywords: "yapay zeka openai kredi motor gpt dalle",
      },
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
