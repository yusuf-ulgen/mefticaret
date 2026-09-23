import { Link } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  Bell,
  CreditCard,
  FileText,
  Globe,
  History,
  Images,
  KeyRound,
  Languages,
  Receipt,
  Search,
  ShieldCheck,
  Truck,
  Users,
  Warehouse,
  Webhook,
} from "lucide-react";

type Item = { label: string; desc: string; to: string; icon: React.ComponentType<{ className?: string }> };

const groups = (p: (s: string) => string): { title: string; items: Item[] }[] => [
  {
    title: "Mağaza Yönetimi",
    items: [
      { label: "Personel", desc: "Mağazanıza personel ekleyin, erişimlerini yönetin.", to: p("team"), icon: Users },
      { label: "Vergi Ayarları", desc: "Farklı vergi oranları ekleyin ve vergi kurallarını düzenleyin.", to: p("tax"), icon: Receipt },
      { label: "Stok Lokasyonları", desc: "Depo ve fiziksel mağaza gibi stok konumlarını yönetin.", to: p("warehouses"), icon: Warehouse },
      { label: "Faturalarım ve Paket", desc: "Paketinizi, faturalarınızı ve ödemelerinizi görün.", to: p("billing"), icon: FileText },
      { label: "Güvenlik", desc: "İki adımlı doğrulama ve oturum güvenliğini yönetin.", to: p("security"), icon: ShieldCheck },
      { label: "Alan Adlarım", desc: "Alan adlarınızı bağlayın ve yönetin.", to: p("domains"), icon: Globe },
    ],
  },
  {
    title: "Ürün ve Sipariş Yönetimi",
    items: [
      { label: "Diller ve Çeviriler", desc: "Farklı diller ekleyin, ürün ve kategori çevirilerini yapın.", to: p("languages"), icon: Languages },
      { label: "Kargo Ayarları", desc: "Kargo firmaları, ücretler ve teslimat kurallarını ayarlayın.", to: p("shipping"), icon: Truck },
      { label: "Ödeme Yöntemleri", desc: "Kart, havale ve kapıda ödeme seçeneklerini yönetin.", to: p("payments"), icon: CreditCard },
      { label: "SEO Ayarları", desc: "Arama motorlarında nasıl görüneceğinizi düzenleyin.", to: p("seo"), icon: Search },
    ],
  },
  {
    title: "Mağaza Etkinliği ve Bağlantı Ayarları",
    items: [
      { label: "Mağaza Etkinlik Geçmişi", desc: "Mağazanızdaki tüm etkinlikleri tek sayfada görün.", to: p("activity"), icon: History },
      { label: "Bildirimler", desc: "E-posta ve SMS bildirimlerini ayarlayın.", to: p("notifications"), icon: Bell },
      { label: "Mağaza Aktarım", desc: "Diğer platformlardaki bilgilerinizi mağazanıza aktarın.", to: p("migration"), icon: ArrowLeftRight },
      { label: "Medya Kütüphanesi", desc: "Yüklenen ve AI ile üretilen görselleri görün.", to: p("media"), icon: Images },
      { label: "API Anahtarları", desc: "Harici uygulamalar için erişim anahtarları oluşturun.", to: p("api"), icon: KeyRound },
      { label: "Webhook'lar", desc: "Olayları dış sistemlere otomatik iletin.", to: p("webhooks"), icon: Webhook },
    ],
  },
];

/** ikas benzeri gruplu ayar merkezi. */
export function SettingsHub({ storeId }: { storeId: string }) {
  const p = (s: string) => `/store/${storeId}/${s}`;
  return (
    <div className="space-y-8">
      {groups(p).map((group) => (
        <section key={group.title} className="space-y-3">
          <h2 className="font-display text-lg font-semibold">{group.title}</h2>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  to={item.to as string}
                  className="flex min-h-16 gap-3 rounded-lg p-3 transition hover:bg-muted"
                >
                  <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                  <span className="grid gap-0.5">
                    <span className="text-sm font-medium">{item.label}</span>
                    <span className="text-sm text-muted-foreground">{item.desc}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
      <h2 className="font-display text-lg font-semibold">Mağaza Ayarları</h2>
    </div>
  );
}
