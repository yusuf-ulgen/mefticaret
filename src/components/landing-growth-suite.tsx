import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgePercent,
  Bot,
  Boxes,
  Languages,
  MailCheck,
  MapPinned,
  PackageCheck,
  ReceiptText,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const SUITE_FEATURES = [
  {
    icon: MapPinned,
    eyebrow: "BÖLGESEL TİCARET",
    title: "Ülkeye özel fiyat ve vergi",
    text: "Kur marjı, psikolojik fiyatlandırma, ülke kataloğu, OSS/IOSS ve teslim vergilerini tek noktadan yönetin.",
    points: ["Çoklu para birimi", "DDP / DDU hesaplama"],
  },
  {
    icon: Languages,
    eyebrow: "ÇOK DİLLİ BÜYÜME",
    title: "AI çeviri ve global SEO",
    text: "Ürün içeriklerini hedef pazara uyarlayın; dil adresleri, hreflang ve Arapça RTL görünümü otomatik işlensin.",
    points: ["EN, DE, FR, AR ve fazlası", "Dil bazlı site haritaları"],
  },
  {
    icon: PackageCheck,
    eyebrow: "İHRACAT & LOJİSTİK",
    title: "Depodan gümrüğe tek akış",
    text: "Çoklu depo yönlendirmesi, taşıyıcı karşılaştırması ve mikro ihracat belgeleriyle operasyonu hızlandırın.",
    points: ["ETGB ve ticari fatura", "Kargo bağlantılarına hazır"],
  },
  {
    icon: MailCheck,
    eyebrow: "PAZARLAMA OTOMASYONU",
    title: "Doğru mesaj, doğru zamanda",
    text: "Terk edilen sepet, bülten, kampanya sayfası ve e-posta akışlarını görsel editörle yönetin.",
    points: ["A/B testi ve açılma raporu", "Vitrin kampanya bantları"],
  },
  {
    icon: BadgePercent,
    eyebrow: "GROWTH & B2B",
    title: "Affiliate ve toptan satış",
    text: "Çok para birimli komisyonlar, promosyon kodları, MOQ, kademeli fiyat ve teklif taleplerini takip edin.",
    points: ["Influencer ROI", "RFQ ve pazaryeri hazırlığı"],
  },
];

const SUMMARY_ITEMS = [
  { icon: TrendingUp, label: "Döviz bazlı kârlılık" },
  { icon: Boxes, label: "Çoklu depo ve 3PL" },
  { icon: ReceiptText, label: "Gümrük belgeleri" },
  { icon: Bot, label: "10+ dilde destek" },
];

export function LandingGrowthSuite() {
  return (
    <section id="global-ticaret" className="overflow-hidden bg-foreground py-20 text-background lg:py-28">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="max-w-3xl">
            <span className="eyebrow text-brand">GLOBAL SATIŞ VE BÜYÜME</span>
            <h2 className="mt-6 text-3xl font-extrabold leading-tight sm:text-4xl lg:text-5xl">
              Dünyaya satış için gereken tüm operasyon tek panelde
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-background/70">
              Yerel fiyatlandırmadan çok dilli SEO’ya, ihracat belgelerinden otomatik kampanyalara
              kadar yeni nesil global ticaret araçları Mefticaret’e dahil.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" variant="secondary" className="rounded-full px-6">
              <Link to="/auth" search={{ mode: "register" }}>
                Ücretsiz başlayın <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full border-background/25 bg-transparent px-6 text-background hover:bg-background/10 hover:text-background"
            >
              <Link to="/e-ticaret-paketleri">Paketleri inceleyin</Link>
            </Button>
          </div>
        </div>

        <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-background/15 bg-background/15 sm:grid-cols-2 lg:grid-cols-6">
          {SUITE_FEATURES.map((feature, index) => (
            <article
              key={feature.title}
              className={`bg-foreground p-6 sm:p-7 ${index < 2 ? "lg:col-span-3" : "lg:col-span-2"}`}
            >
              <feature.icon className="size-6 text-brand" aria-hidden="true" />
              <p className="mt-5 text-xs font-semibold uppercase text-brand">{feature.eyebrow}</p>
              <h3 className="mt-3 text-xl font-semibold leading-snug">{feature.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-background/65">{feature.text}</p>
              <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-background/80">
                {feature.points.map((point) => (
                  <li key={point} className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 border-t border-background/15 pt-8 lg:grid-cols-4">
          {SUMMARY_ITEMS.map((item) => (
            <div key={item.label} className="flex min-w-0 items-center gap-3 text-sm font-medium">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-background/10 text-background">
                <item.icon className="size-4" aria-hidden="true" />
              </span>
              <span className="leading-snug text-background/80">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}