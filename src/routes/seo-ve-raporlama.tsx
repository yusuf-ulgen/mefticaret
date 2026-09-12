import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Gauge,
  Image as ImageIcon,
  Link2,
  Map,
  Search,
  Tags,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const TITLE = "SEO ve Raporlama — Trafiğinizi Tek Ekrandan Takip Edin";
const DESCRIPTION =
  "Mefticaret'in ileri raporlama ve SEO araçlarıyla dönüşüm, stok ve satış kanalı raporlarını tek ekrandan izleyin; SEO dostu URL, otomatik meta etiket, görsel optimizasyonu, yönlendirme ve site haritalarıyla organik trafiğinizi artırın.";
const URL = "https://mefticaret.com/seo-ve-raporlama";
const OG_IMAGE = "https://mefticaret.com/og-mefticaret.jpg";

export const Route = createFileRoute("/seo-ve-raporlama")({
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
          headline: "SEO ve raporlama: trafiğinizi tek ekrandan takip edin",
          description: DESCRIPTION,
          image: OG_IMAGE,
          inLanguage: "tr-TR",
          author: { "@type": "Organization", name: "Mefticaret" },
          publisher: { "@type": "Organization", name: "Mefticaret" },
          mainEntityOfPage: URL,
          datePublished: "2026-09-12",
          dateModified: "2026-09-12",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Ana sayfa", item: "https://mefticaret.com/" },
            { "@type": "ListItem", position: 2, name: "SEO ve raporlama", item: URL },
          ],
        }),
      },
    ],
  }),
  component: SeoReportingPage,
});

const REPORTS = [
  {
    icon: TrendingUp,
    title: "Dönüşüm raporları",
    body: "Ziyaretten sepete, sepetten siparişe kadar her adımın dönüşüm oranını görün; nerede kayıp yaşandığını net biçimde tespit edin.",
  },
  {
    icon: BarChart3,
    title: "Satış kanalı raporları",
    body: "Hangi kanaldan ne zaman satış yapıldığını izleyin; vitrin, pazaryeri ve mobil uygulama performansını yan yana karşılaştırın.",
  },
  {
    icon: Gauge,
    title: "Stok ve verimlilik",
    body: "Tükenmek üzere olan ürünleri, ölü stoğu ve en hızlı dönen kalemleri aynı ekranda takip ederek satış verimliliğinizi artırın.",
  },
];

const SEO_FEATURES = [
  {
    icon: Link2,
    title: "SEO uyumlu URL yapısı",
    body: "Ürün, kategori ve içerik sayfalarınız için SEO dostu URL yapısı oluşturun; hızlı, kolay ve etkili biçimde organik trafiğinizi artırın.",
  },
  {
    icon: ImageIcon,
    title: "Görsel optimizasyonu",
    body: "Yüklediğiniz görseller otomatik olarak optimize edilir; siteniz daha hızlı açılır ve görselleriniz her cihazda en iyi şekilde görünür.",
  },
  {
    icon: Search,
    title: "Yönlendirmeler",
    body: "301 ve 302 yönlendirmelerini kolayca yönetin; sitenizin SEO değerini koruyarak trafiği doğru sayfalara aktarın.",
  },
  {
    icon: Tags,
    title: "Otomatik meta etiketler",
    body: "Otomatik oluşturulan meta başlık ve açıklamalar sayesinde sayfalarınız arama sonuçlarında daha görünür olur, daha fazla ziyaretçiye ulaşır.",
  },
  {
    icon: Search,
    title: "Ürün açıklamalarından arama sonuçlarına",
    body: "Panelden SEO dostu ürün URL'i oluşturun, ürün sayfanızın başlığını ve açıklamalarını profesyonel biçimde yönetin, tıklama oranlarını yükseltin.",
  },
  {
    icon: Map,
    title: "Otomatik site haritaları",
    body: "Site haritaları otomatik güncellenir. Yeni bir sayfa veya ürün açtığınızda ekstra bir işlem yapmanız gerekmez.",
  },
];

function SeoReportingPage() {
  return (
    <main className="bg-background">
      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-20 lg:py-28">
          <span className="eyebrow">SEO ve raporlama</span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl">
            Tüm trafiğinizi tek ekrandan takip edin
          </h1>
          <p className="mt-6 max-w-3xl text-lg text-muted-foreground">
            Mefticaret'in ileri raporlama özellikleriyle dönüşüm, stok ve satış kanalı raporlarına tek
            bir ekrandan kolayca erişin. Hiçbir eklentiye ihtiyaç duymadan, detaylı trafik
            raporlarıyla hangi kanaldan ne zaman satış yapıldığını izleyin ve satış verimliliğinizi
            artırın.
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
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-16 lg:py-24">
          <h2 className="text-3xl font-extrabold sm:text-4xl">Tek ekranda raporlama</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {REPORTS.map((item) => (
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
          <h2 className="text-3xl font-extrabold sm:text-4xl">
            SEO ile arama motorlarında zirveye çıkın
          </h2>
          <p className="mt-4 max-w-3xl text-muted-foreground">
            Web sitenizi Mefticaret SEO ayarlarıyla kolayca optimize ederek arama motorlarındaki
            organik sıralamalarınızı ve görünürlüğünüzü artırın, satışlarınızı katlayın.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {SEO_FEATURES.map((item) => (
              <article key={item.title} className="showcase-card p-6">
                <item.icon className="size-5 text-muted-foreground" aria-hidden="true" />
                <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-3xl px-6 py-20 text-center lg:py-28">
          <h2 className="text-3xl font-extrabold sm:text-4xl">
            Raporlar ve SEO ayarları aynı panelde
          </h2>
          <p className="mt-4 text-muted-foreground">
            Mağazanızı açın, SEO ayarlarınızı dakikalar içinde tamamlayın ve trafiğinizi ilk günden
            takip etmeye başlayın.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild className="rounded-full">
              <Link to="/auth" search={{ mode: "register" }}>
                Hemen başla <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/pazaryeri-entegrasyonu">Pazaryeri entegrasyonu</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
