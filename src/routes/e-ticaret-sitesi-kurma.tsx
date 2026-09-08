import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Box,
  CreditCard,
  Globe,
  LayoutTemplate,
  Megaphone,
  PackageCheck,
  Search,
  ShieldCheck,
  Store,
  Truck,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const TITLE = "E-Ticaret Sitesi Kurma Rehberi 2026 — Adım Adım Başlangıç";
const DESCRIPTION =
  "E-ticaret sitesi kurmak isteyenlere adım adım rehber: niş seçiminden alan adı, ödeme, kargo, pazaryeri entegrasyonu ve büyüme stratejilerine kadar her aşama.";
const URL = "https://mefticaret.com/e-ticaret-sitesi-kurma";

export const Route = createFileRoute("/e-ticaret-sitesi-kurma")({
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
          headline: "E-Ticaret Sitesi Kurma Rehberi 2026",
          description: DESCRIPTION,
          image: "https://mefticaret.com/og-mefticaret.jpg",
          inLanguage: "tr-TR",
          author: { "@type": "Organization", name: "Mefticaret" },
          publisher: { "@type": "Organization", name: "Mefticaret" },
          mainEntityOfPage: URL,
          datePublished: "2026-09-07",
          dateModified: "2026-09-07",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Ana sayfa", item: "https://mefticaret.com/" },
            { "@type": "ListItem", position: 2, name: "E-ticaret sitesi kurma", item: URL },
          ],
        }),
      },
    ],
  }),
  component: EcommerceGuidePage,
});

const STEPS = [
  {
    icon: Search,
    title: "1. Satacağınız ürün ve nişi belirleyin",
    body: "Başarılı bir e-ticaret sitesi, genel katalogtan ziyade odaklı bir ürün gamıyla başlar. Kendi uzmanlık alanınız, tedarik gücünüz veya talep gören ancak rekabetin düşük olduğu bir segment seçin. Başlangıçta 10–20 ürünle test edin, stok riskini düşük tutun.",
    tip: "Mefticaret ile her mağaza bağımsız bir veritabanı kiracısıdır; aynı panelden birden fazla niş markası deneyebilirsiniz.",
  },
  {
    icon: Users,
    title: "2. Hedef kitlenizi tanımlayın",
    body: "Yaş, cinsiyet, coğrafya, alışveriş alışkanlıkları ve ağrı noktalarını not alın. Bu bilgi vitrin metinlerinden kargo politikasına, ödeme seçeneklerinden pazarlama kanallarına kadar her kararı yönlendirir.",
    tip: "Mağaza içi analitik ve canlı trafik takibi sayesinde ziyaretçi davranışlarını gerçek zamanlı gözlemleyin.",
  },
  {
    icon: Globe,
    title: "3. Alan adı ve marka kimliği oluşturun",
    body: "Akılda kalıcı, kısa ve telaffuzu kolay bir alan adı seçin. Logo, renk paleti ve tipografi kurallarınızı bir marka kitapçığında toplayın; tutarlılık güven oluşturur.",
    tip: "Mefticaret'te özel domain, alt domain ve çoklu dil desteği tek tıkla yönetilir; her mağaza için ayrı canonical ve hreflang ayarları üretilir.",
  },
  {
    icon: LayoutTemplate,
    title: "4. E-ticaret altyapınızı seçin",
    body: "Kira, komisyon, tema esnekliği, pazaryeri entegrasyonu, stok yönetimi ve destek hizmetlerini karşılaştırın. SaaS çözümler hızlı başlangıç sunar; açık kaynak seçenekler ise yüksek bakım maliyeti getirir.",
    tip: "Mefticaret, çok mağazalı yapı, sürükle-bırak tema editörü, otomatik SEO, XML entegratör ve pazaryeri operasyonunu tek abonelikte birleştirir.",
  },
  {
    icon: Box,
    title: "5. Ürün ve katalog yönetimini planlayın",
    body: "Her ürün için net başlık, açıklama, varyant (beden, renk), barkod, ağırlık, GTIN ve çok açılı fotoğraflar hazırlayın. Kategorileri mantıksal bir hiyerarşide düzenleyin; arama motorları ve müşteriler için aynı derecede önemlidir.",
    tip: "AI ürün açıklaması ve kategori stüdyosu, toplu içe aktarma ve XML/B2B entegratörü sayesinde katalogu saatler içinde hazırlayabilirsiniz.",
  },
  {
    icon: CreditCard,
    title: "6. Ödeme altyapısını kurun",
    body: "Kredi kartı, havale/EFT, kapıda ödeme ve taksit seçeneklerini hedef kitlenize göre belirleyin. Güvenlik sertifikası (SSL) ve 3D Secure zorunludur; PCI-DSS uyumlu altyapı tercih edin.",
    tip: "Mefticaret ödeme kurallarını mağaza ve pazaryeri bazında ayrı ayrı yönetmenizi sağlar; sipariş anlık ödeme snapshot'ı ile saklanır.",
  },
  {
    icon: Truck,
    title: "7. Kargo ve iade süreçlerini otomatikleştirin",
    body: "Entegre kargo şirketleri, otomatik kargo etiketi ve sipariş durumu bildirimleri operasyon yükünü azaltır. Net iade politikası hem müşteri güvenini artırır hem de hukuki riski düşürür.",
    tip: "İade edilen ürünler otomatik olarak stoğa geri ekilir ve sipariş kaydı ayrılmaz; depo ve çoklu varyant stoku tek ekrandan takip edilir.",
  },
  {
    icon: Store,
    title: "8. Pazaryeri ve sosyal satış kanallarını açın",
    body: "Trendyol, Hepsiburada, Amazon ve sosyal medya satışları aynı stok havuzundan beslenmelidir. Fiyat, stok ve içerik uyumsuzluğu hem cezaya hem müşteri şikayetine yol açar.",
    tip: "Omni-Channel modülü, pazaryeri listeleyici, fiyat senkronizasyonu ve otomatik stok iade akışıyla kanalları merkezi yönetir.",
  },
  {
    icon: BarChart3,
    title: "9. SEO ve içerik stratejisi oluşturun",
    body: "Her kategori ve ürün sayfasına özgün başlık, meta açıklama, URL ve yapısal veri ekleyin. Düzenli blog içeriği, uzun kuyruklu anahtar kelimelerden organik trafik çeker.",
    tip: "SEO Center otomatik site haritası, robots.txt, canonical, Schema.org ve AI blog yazarı sunar; Google Search Console entegrasyonu ile index durumunu izlersiniz.",
  },
  {
    icon: Megaphone,
    title: "10. Pazarlama ve müşteri sadakati başlatın",
    body: "Google Ads, Meta Pixel, GA4, GTM ve CAPI kurulumlarını erken tamamlayın. E-posta/SMS pazarlama, indirim kodları, sadakat puanları ve sepet terk kampanyaları dönüşümü artırır.",
    tip: "Site Kit, Visual Automation Builder ve Verimor SMS entegrasyonu ile kampanyaları kod yazmadan otomatikleştirin.",
  },
  {
    icon: ShieldCheck,
    title: "11. KVKK/GDPR ve yasal uyumu sağlayın",
    body: "Aydınlatma metni, mesafeli satış sözleşmesi, iptal/iade formu, çerez politikası ve açık rıza mekanizmalarını hazır edin. Hukuki metinleri periyodik olarak güncelleyin.",
    tip: "AI hukuki içerik asistanı, KVKK/GDPR uyumlu metin önerileri ve otomatik versiyonlama ile dokümanları güncel tutar.",
  },
  {
    icon: PackageCheck,
    title: "12. Canlıya alın ve sürekli ölçeklendirin",
    body: "Yumuşak bir lansman yapın: önce yakın çevre, sonra küçük bütçeli reklam. A/B testleri, dönüşüm hunisi ve müşteri geri bildirimleriyle sayfaları iyileştirin.",
    tip: "Canlı demo önizleme, tema sürüm geri alma ve detaylı raporlar sayesinde riski minimize ederek büyürsünüz.",
  },
];

const MISTAKES = [
  "Stoksuz satış yapmak ve pazaryeri cezalarını göze almak.",
  "Mobil uyumluluğu test etmeden vitrini yayınlamak.",
  "Yasal metinleri kopyala-yapıştır ile hazırlamak.",
  "Sadece ücretli trafikle büyümeye çalışmak; organik SEO’yu ihmal etmek.",
  "Müşteri desteğini sadece sosyal medya DM’lerine bırakmak.",
];

const FAQS = [
  {
    q: "E-ticaret sitesi kurmak için teknik bilgi gerekir mi?",
    a: "Günümüz SaaS e-ticaret platformları kod bilgisi gerektirmez. Mefticaret'te tema editörü, sürükle-bırak otomasyonları ve hazır entegrasyonlarla teknik ekibe ihtiyaç duymadan yönetebilirsiniz.",
  },
  {
    q: "Hangi ödeme sistemlerini entegre etmeliyim?",
    a: "Hedef kitlenize göre kredi/banka kartı, havale/EFT, kapıda ödeme ve taksit seçenekleri sunun. 3D Secure ve SSL sertifikası zorunludur.",
  },
  {
    q: "Pazaryeri entegrasyonu neden önemli?",
    a: "Pazaryerleri hazır trafik sağlar, ancak stok ve fiyat uyumsuzluğu cezaya yol açar. Merkezi entegrasyon sayesinde tüm kanallar tek stok havuzundan beslenir.",
  },
  {
    q: "E-ticaret sitesini kaç ürünle açmalıyım?",
    a: "Kaliteyi koruyarak 10–20 ürünle başlamak idealdir. Katalogu zaman içinde genişletmek, operasyonu ve müşteri deneyimini ölçmeyi kolaylaştırır.",
  },
];

function StepCard({
  step,
}: {
  step: (typeof STEPS)[number];
}) {
  const Icon = step.icon;
  return (
    <article className="rounded-2xl border bg-card p-6 shadow-sm transition hover:shadow-md">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <h2 className="text-lg font-semibold tracking-tight">{step.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
      <div className="mt-4 rounded-xl bg-muted/60 p-3 text-sm">
        <span className="font-semibold text-foreground">Mefticaret ile: </span>
        <span className="text-muted-foreground">{step.tip}</span>
      </div>
    </article>
  );
}

function EcommerceGuidePage() {
  return (
    <main className="min-h-screen">
      <section className="border-b bg-background px-6 py-16 lg:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 inline-flex items-center rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand">
            2026 başlangıç rehberi
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            E-Ticaret Sitesi Kurma Rehberi
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            İlk siparişten pazaryeri entegrasyonuna, SEO'dan operasyonel otomasyona kadar e-ticaret
            mağazanızı adım adım ve hatasız açın.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="rounded-full">
              <a href="/auth">
                Ücretsiz başla
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </a>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-full">
              <Link to="/en-iyi-e-ticaret-altyapisi">Altyapı karşılaştırması</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="px-6 py-12 lg:py-20">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((step) => (
              <StepCard key={step.title} step={step} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-y bg-muted/40 px-6 py-12 lg:py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight">Yaygın başlangıç hataları</h2>
          <p className="mt-2 text-muted-foreground">
            Bu listeyi lansman öncesi kontrol listesi olarak kullanın; hem operasyonel hem yasal
            riskleri azaltır.
          </p>
          <ul className="mt-6 space-y-3">
            {MISTAKES.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-destructive" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="px-6 py-12 lg:py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight">Sık sorulan sorular</h2>
          <div className="mt-6 space-y-4">
            {FAQS.map((faq) => (
              <details
                key={faq.q}
                className="group rounded-xl border bg-card p-4 open:bg-card"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-foreground">
                  {faq.q}
                  <span className="ml-4 text-muted-foreground transition group-open:rotate-180">
                    ▼
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-brand px-6 py-16 text-brand-foreground lg:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight">
            Mağazanızı 15 dakika içinde açın
          </h2>
          <p className="mt-4 text-lg opacity-90">
            Mefticaret ile tema, ürün, ödeme, kargo ve pazaryeri entegrasyonlarını tek panelden
            kurun; canlı demo önizlemesiyle riski azaltın.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" variant="secondary" className="rounded-full">
              <a href="/auth">Hemen ücretsiz dene</a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full border-brand-foreground/30 text-brand-foreground hover:bg-brand-foreground/10"
            >
              <Link to="/en-iyi-e-ticaret-altyapisi">Altyapıyı incele</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
