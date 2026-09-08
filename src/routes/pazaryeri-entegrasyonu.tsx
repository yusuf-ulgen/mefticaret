import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  FileJson,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  Store,
  Truck,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const TITLE = "Pazaryeri Entegrasyonu — Trendyol, Hepsiburada, Amazon Tek Panelde";
const DESCRIPTION =
  "Pazaryeri entegrasyonu ile Trendyol, Hepsiburada, Amazon ve N11 mağazalarınızın stok, fiyat ve sipariş verilerini tek panelden otomatik senkronize edin.";
const URL = "https://mefticaret.com/pazaryeri-entegrasyonu";
const OG_IMAGE = "https://mefticaret.com/og-mefticaret.jpg";

export const Route = createFileRoute("/pazaryeri-entegrasyonu")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
      { property: "og:image", content: OG_IMAGE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Pazaryeri Entegrasyonu Nasıl Yapılır?",
          description: DESCRIPTION,
          image: OG_IMAGE,
          inLanguage: "tr-TR",
          author: { "@type": "Organization", name: "Mefticaret" },
          publisher: { "@type": "Organization", name: "Mefticaret" },
          mainEntityOfPage: URL,
          datePublished: "2026-09-08",
          dateModified: "2026-09-08",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Ana sayfa", item: "https://mefticaret.com/" },
            { "@type": "ListItem", position: 2, name: "Pazaryeri entegrasyonu", item: URL },
          ],
        }),
      },
    ],
  }),
  component: MarketplaceIntegrationPage,
});

const MARKETPLACES = [
  "Trendyol",
  "Hepsiburada",
  "Amazon",
  "N11",
  "Çiçeksepeti",
  "PttAVM",
  "Pazarama",
  "eBay",
  "Etsy",
  "Ozon",
];

const CAPABILITIES = [
  {
    icon: Boxes,
    title: "Tek stok havuzu",
    body: "Tüm pazaryerleri ve kendi vitrininiz aynı stok havuzunu kullanır; bir kanalda satış olduğunda diğerlerinde stok anında düşer.",
  },
  {
    icon: RefreshCw,
    title: "Otomatik fiyat senkronizasyonu",
    body: "Kanal bazlı kâr marjı, komisyon ve yuvarlama kuralları tanımlayın; fiyat güncellemeleri planlı olarak pazaryerlerine gönderilir.",
  },
  {
    icon: PackageCheck,
    title: "Sipariş akışı",
    body: "Tüm kanallardan gelen siparişler tek listede toplanır; onay, paketleme ve fatura adımlarını aynı ekrandan yürütürsünüz.",
  },
  {
    icon: Truck,
    title: "Kargo ve iade",
    body: "Kargo etiketleri ve takip kodları kanala geri yazılır; iade onaylandığında stok otomatik olarak geri eklenir.",
  },
  {
    icon: FileJson,
    title: "XML / API ile tedarikçi bağlantısı",
    body: "Tedarikçi XML ve API kaynaklarını eşleyip ürünleri pazaryerlerine aktarın; stok ve fiyat güncellemeleri zamanlanmış turlarla gelir.",
  },
  {
    icon: BarChart3,
    title: "Kanal bazlı raporlama",
    body: "Hangi pazaryerinin ne kadar ciro, kâr ve iade oranı ürettiğini karşılaştırmalı olarak görün.",
  },
];

const STEPS = [
  {
    title: "1. Mağazanızı oluşturun",
    body: "Mefticaret'te mağazanızı açın, ürünlerinizi ve kategori yapınızı hazırlayın.",
  },
  {
    title: "2. Pazaryeri uygulamasını kurun",
    body: "Uygulama Mağazası'ndan çalışmak istediğiniz pazaryerini seçip satıcı API bilgilerinizi girin.",
  },
  {
    title: "3. Kategori ve özellik eşlemesi yapın",
    body: "Kendi kategorilerinizi pazaryeri kategorileriyle eşleyin, zorunlu ürün özelliklerini tamamlayın.",
  },
  {
    title: "4. Fiyat ve stok kurallarını tanımlayın",
    body: "Komisyon ve kargo maliyetini içeren kanal fiyatı, minimum stok ve tampon stok kurallarını belirleyin.",
  },
  {
    title: "5. Ürünleri gönderin ve izleyin",
    body: "Ürünleri aktarın; onay durumlarını, hataları ve senkronizasyon kayıtlarını panelden takip edin.",
  },
  {
    title: "6. Siparişleri tek panelden yönetin",
    body: "Gelen siparişleri işleyin, kargolayın, iadeleri sonuçlandırın; muhasebe kayıtları otomatik oluşur.",
  },
];

function MarketplaceIntegrationPage() {
  return (
    <main className="bg-background">
      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-20 lg:py-28">
          <span className="eyebrow">Pazaryeri entegrasyonu</span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl">
            Pazaryeri entegrasyonu: Trendyol, Hepsiburada ve Amazon tek panelde
          </h1>
          <p className="mt-6 max-w-3xl text-lg text-muted-foreground">
            Birden fazla pazaryerinde satış yapmanın en zor tarafı stok, fiyat ve sipariş
            senkronizasyonudur. Mefticaret pazaryeri entegrasyonu, tüm kanallarınızı tek stok
            havuzuna bağlar; satış, iade ve kargo hareketlerini otomatik olarak eşitler.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild className="rounded-full">
              <Link to="/auth" search={{ mode: "register" }}>
                Ücretsiz mağaza aç <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/en-iyi-e-ticaret-altyapisi">Altyapı karşılaştırması</Link>
            </Button>
          </div>
          <ul className="mt-10 flex flex-wrap gap-2">
            {MARKETPLACES.map((name) => (
              <li
                key={name}
                className="rounded-full border border-border px-4 py-1.5 text-sm text-muted-foreground"
              >
                {name}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-16 lg:py-24">
          <h2 className="text-3xl font-extrabold sm:text-4xl">Entegrasyon neleri otomatikleştirir?</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {CAPABILITIES.map((item) => (
              <article key={item.title} className="showcase-card p-6">
                <item.icon className="size-5 text-muted-foreground" aria-hidden="true" />
                <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-secondary/40">
        <div className="mx-auto max-w-5xl px-6 py-16 lg:py-24">
          <h2 className="text-3xl font-extrabold sm:text-4xl">6 adımda pazaryeri entegrasyonu</h2>
          <ol className="mt-10 space-y-6">
            {STEPS.map((step) => (
              <li key={step.title} className="showcase-card p-6">
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-16 lg:py-24">
          <h2 className="text-3xl font-extrabold sm:text-4xl">Çok kanallı satışta sık yapılan hatalar</h2>
          <ul className="mt-8 space-y-4 text-muted-foreground">
            <li className="flex gap-3">
              <ShieldCheck className="mt-1 size-4 shrink-0" aria-hidden="true" />
              Tampon stok tanımlamamak: son ürünü aynı anda iki kanalda satmak iptal ve ceza puanı
              getirir.
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="mt-1 size-4 shrink-0" aria-hidden="true" />
              Kanal komisyonunu fiyata yansıtmamak: ciro artarken kâr marjı erir.
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="mt-1 size-4 shrink-0" aria-hidden="true" />
              Ürün başlık ve özelliklerini pazaryeri kurallarına uyarlamamak: ürünler onaydan geçmez.
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="mt-1 size-4 shrink-0" aria-hidden="true" />
              İade sürecini stoktan bağımsız işletmek: satılabilir ürünler envanterde görünmez kalır.
            </li>
          </ul>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-3xl px-6 py-20 text-center lg:py-28">
          <Store className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
          <h2 className="mt-6 text-3xl font-extrabold sm:text-4xl">
            Tüm pazaryerlerinizi tek panelden yönetin
          </h2>
          <p className="mt-4 text-muted-foreground">
            Mağazanızı açın, pazaryeri uygulamalarını kurun ve stok–fiyat–sipariş akışını otomatiğe
            alın.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild className="rounded-full">
              <Link to="/auth" search={{ mode: "register" }}>
                Hemen başla <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/dropshipping-nasil-yapilir">Dropshipping rehberi</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
