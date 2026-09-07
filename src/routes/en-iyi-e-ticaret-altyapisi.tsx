import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, Minus } from "lucide-react";

import { fetchShowcaseStores } from "@/lib/showcase.functions";

const TITLE = "En İyi E-Ticaret Altyapısı 2026 — Karşılaştırma ve Rehber";
const DESCRIPTION =
  "En iyi e-ticaret altyapısı nasıl seçilir? Mefticaret'in çok mağazalı SaaS altyapısını fiyat, pazaryeri entegrasyonu, tema editörü ve SEO özellikleriyle karşılaştırın.";
const URL = "https://mefticaret.com/en-iyi-e-ticaret-altyapisi";


export const Route = createFileRoute("/en-iyi-e-ticaret-altyapisi")({
  loader: async () => ({ stores: await fetchShowcaseStores() }),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: TITLE,
          description: DESCRIPTION,
          inLanguage: "tr-TR",
          author: { "@type": "Organization", name: "Mefticaret" },
          publisher: { "@type": "Organization", name: "Mefticaret" },
          mainEntityOfPage: URL,
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Ana sayfa", item: "https://mefticaret.com/" },
            { "@type": "ListItem", position: 2, name: "En iyi e-ticaret altyapısı", item: URL },

          ],
        }),
      },
    ],
  }),
  component: BestInfrastructurePage,
});

const CRITERIA = [
  {
    title: "Çok mağazalı (multi-tenant) izolasyon",
    body: "Tek hesapla birden fazla mağaza açabilmeli ve mağazalar birbirinin verisini asla görmemeli. Mefticaret'te her tablo mağaza kimliğine bağlıdır ve veritabanı seviyesinde satır bazlı güvenlik kurallarıyla korunur.",
  },
  {
    title: "Pazaryeri ve sosyal satış entegrasyonu",
    body: "Trendyol, Hepsiburada, Facebook Marketplace ilanları ile Instagram ve TikTok mesaj otomasyonu ürün, fiyat ve stok verisiyle eşitlenir; her kanal için ayrı panel gerekmez.",
  },
  {
    title: "Sürükle-bırak tema editörü",
    body: "Vitrin bölümleri, renk ve tipografi ayarları, masaüstü/tablet/mobil kırılımları ve sürüm geri alma tek ekranda yönetilir. Tema yayınlandığında ürün, kargo ve ödeme verisi otomatik dolar.",
  },
  {
    title: "Yerleşik SEO ve içerik üretimi",
    body: "Her mağaza için otomatik site haritası, robots kuralları, canonical ve yapısal veri üretilir; yapay zekâ destekli içerik stüdyosu ürün açıklaması ve blog yazısı hazırlar.",
  },
  {
    title: "Stok, sipariş ve kargo bütünlüğü",
    body: "Varyant bazlı stok, çoklu depo, rezervasyon, iade ile otomatik stok artışı ve kargo etiketi akışı aynı veri modelinde çalışır.",
  },
  {
    title: "Ölçek ve maliyet şeffaflığı",
    body: "Planlar veritabanından yönetilir; mağaza, ürün ve trafik limitleri panelden görülür. Altyapı binlerce mağaza ve eşzamanlı ziyaretçi trafiğini karşılayacak biçimde indekslenmiş ve önbelleklenmiştir.",
  },
];

const COMPARISON: { label: string; mefti: boolean; hosted: boolean; opensource: boolean }[] = [
  { label: "Tek hesapta sınırsız mağaza", mefti: true, hosted: false, opensource: true },
  { label: "Kurulum ve sunucu bakımı gerekmez", mefti: true, hosted: true, opensource: false },
  { label: "Türkçe panel ve TRY fiyatlandırma", mefti: true, hosted: false, opensource: false },
  { label: "Yerleşik pazaryeri entegrasyonları", mefti: true, hosted: false, opensource: false },
  { label: "Uygulama mağazası ile tek tık kurulum", mefti: true, hosted: true, opensource: false },
  { label: "Yapay zekâ içerik ve SEO otomasyonu", mefti: true, hosted: false, opensource: false },
  { label: "Süper yönetici ile tam platform kontrolü", mefti: true, hosted: false, opensource: true },
];

function Cell({ value }: { value: boolean }) {
  return (
    <td className="border-t border-border px-4 py-3 text-center">
      {value ? (
        <Check className="mx-auto h-4 w-4 text-[color:var(--color-brand)]" aria-label="Var" />
      ) : (
        <Minus className="mx-auto h-4 w-4 text-muted-foreground" aria-label="Yok" />
      )}
    </td>
  );
}

function BestInfrastructurePage() {
  const { stores } = Route.useLoaderData();

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-14 sm:px-8 sm:py-20">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--color-brand)]">
        Rehber · 2026
      </p>
      <h1 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
        En iyi e-ticaret altyapısı nasıl seçilir?
      </h1>
      <p className="mt-5 max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">
        E-ticaret altyapısı seçerken tek soru “hangi panel daha güzel” değil; mağazanızın stok, sipariş,
        kargo, ödeme, pazaryeri ve SEO süreçlerinin aynı veri modelinde çalışıp çalışmadığıdır. Aşağıda
        karar verirken bakmanız gereken altı ölçütü, rakip yaklaşımlarla karşılaştırmayı ve Mefticaret
        altyapısında yayında olan gerçek mağaza vitrinlerini bulacaksınız.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to="/register"
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background"
        >
          Ücretsiz mağaza aç <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          to="/e-ticaret-sitesi-kurma"
          className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold"
        >
          Başlangıç rehberi
        </Link>
        <Link
          to="/dropshipping-nasil-yapilir"
          className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold"
        >
          Dropshipping rehberi
        </Link>
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold"
        >
          Platform özellikleri
        </Link>
      </div>


      <section className="mt-16">
        <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Altyapı seçiminde altı belirleyici ölçüt
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {CRITERIA.map((item) => (
            <article key={item.title} className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-base font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Mefticaret, kapalı SaaS paketleri ve açık kaynak kurulumlar
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Karşılaştırma, Mefticaret'in yayında olan özellikleri ile iki yaygın alternatif yaklaşımın
          tipik kapsamını gösterir.
        </p>
        <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-muted/60 text-left">
              <tr>
                <th className="px-4 py-3 font-semibold">Özellik</th>
                <th className="px-4 py-3 text-center font-semibold">Mefticaret</th>
                <th className="px-4 py-3 text-center font-semibold">Kapalı SaaS paketi</th>
                <th className="px-4 py-3 text-center font-semibold">Açık kaynak kurulum</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row) => (
                <tr key={row.label}>
                  <td className="border-t border-border px-4 py-3">{row.label}</td>
                  <Cell value={row.mefti} />
                  <Cell value={row.hosted} />
                  <Cell value={row.opensource} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Mefticaret altyapısında yayında olan mağazalar
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Aşağıdaki vitrinler bu altyapıda çalışıyor; ürün, kategori, stok ve sepet akışını canlı
          inceleyebilirsiniz.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stores.length === 0 ? (
            <p className="text-sm text-muted-foreground">Yayında mağaza bulunmuyor.</p>
          ) : (
            stores.map((store) => (
              <Link
                key={store.slug}
                to="/s/$slug"
                params={{ slug: store.slug }}
                className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-foreground"
              >
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  {store.industry}
                </p>
                <h3 className="mt-2 text-base font-semibold">{store.name}</h3>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[color:var(--color-brand)]">
                  Vitrini gör <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))
          )}
        </div>
      </section>

      <section className="mt-16 rounded-3xl border border-border bg-card p-6 sm:p-10">
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          Kendi mağazanızı bugün açın
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Ürünlerinizi yükleyin, temanızı seçin, kargo ve ödeme yöntemlerinizi tanımlayın. Pazaryeri ve
          sosyal kanal entegrasyonlarını uygulama mağazasından tek tıkla ekleyin.
        </p>
        <Link
          to="/register"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background"
        >
          Hemen başla <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </main>
  );
}
