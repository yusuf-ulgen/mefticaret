import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CreditCard,
  Globe,
  LayoutTemplate,
  Package,
  Scale,
  Store,
  Truck,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const TITLE = "E-Ticaret Nasıl Yapılır? 5 Adımda Başlangıç Rehberi (2026)";
const DESCRIPTION =
  "E-ticaret nasıl yapılır? 5 adımda kurulum, e-ticaret için neler gerekli, gerçek maliyetler ve kendi sitem mi pazaryeri mi sorusunun cevabı tek Türkçe rehberde.";
const URL = "https://mefticaret.com/e-ticaret-nasil-yapilir";
const EN_URL = "https://mefticaret.com/en/how-to-start-an-online-store";

const TOC = [
  { href: "#adimlar", label: "5 adımda e-ticaret" },
  { href: "#gerekli", label: "Neler gerekli?" },
  { href: "#maliyet", label: "Maliyetler" },
  { href: "#kanal-karari", label: "Kendi sitem mi, pazaryeri mi?" },
  { href: "#sss", label: "Sık sorulan sorular" },
];

const RELATED: { to: string; title: string; text: string }[] = [
  {
    to: "/e-ticaret-sitesi-kurma",
    title: "E-ticaret sitesi kurma",
    text: "Vitrin, tema ve alan adı kurulumunun ekran ekran anlatımı.",
  },
  {
    to: "/e-ticaret-paketleri",
    title: "E-ticaret paketleri ve fiyatlar",
    text: "Paket limitleri, komisyon oranları ve aylık/yıllık fiyat karşılaştırması.",
  },
  {
    to: "/pazaryeri-entegrasyonu",
    title: "Pazaryeri entegrasyonu",
    text: "Trendyol, Hepsiburada ve diğer kanallarda stok-fiyat senkronizasyonu.",
  },
  {
    to: "/dropshipping-nasil-yapilir",
    title: "Dropshipping nasıl yapılır?",
    text: "Stok tutmadan satış modelinin kurulumu, kâr marjı ve riskleri.",
  },
  {
    to: "/en-iyi-e-ticaret-altyapisi",
    title: "En iyi e-ticaret altyapısı",
    text: "Altyapı seçerken bakılacak kriterler ve karşılaştırma.",
  },
  {
    to: "/seo-ve-raporlama",
    title: "SEO ve raporlama",
    text: "Ürün sayfalarının Google'da görünmesi ve satış raporları.",
  },
];

export const Route = createFileRoute("/e-ticaret-nasil-yapilir")({
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
    links: [
      { rel: "canonical", href: URL },
      { rel: "alternate", hrefLang: "tr", href: URL },
      { rel: "alternate", hrefLang: "en", href: EN_URL },
      { rel: "alternate", hrefLang: "x-default", href: URL },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "E-Ticaret Nasıl Yapılır? 2026 Adım Adım Rehber",
          description: DESCRIPTION,
          inLanguage: "tr-TR",
          author: { "@type": "Organization", name: "Mefticaret" },
          publisher: { "@type": "Organization", name: "Mefticaret" },
          mainEntityOfPage: URL,
          datePublished: "2026-09-18",
          dateModified: "2026-09-18",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Ana sayfa", item: "https://mefticaret.com/" },
            { "@type": "ListItem", position: 2, name: "E-ticaret nasıl yapılır", item: URL },
          ],
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        }),
      },
    ],
  }),
  component: EcommerceHowToPage,
});

const STEPS = [
  {
    icon: Package,
    title: "1. Satacağınız ürünü belirleyin",
    body: "E-ticaret tek cümleyle 'ürününü internetten satmak'tır; her şey ürün seçimiyle başlar. Kendi üretiminiz, tedarik gücünüz veya iyi bildiğiniz bir niş en sağlam başlangıç noktasıdır. İlk ay 10–20 ürünle test edin, sermayenizi tek ürüne kilitlemeyin.",
  },
  {
    icon: LayoutTemplate,
    title: "2. E-ticaret altyapınızı seçin",
    body: "Hazır bir e-ticaret platformu (SaaS), size vitrin, sepet, ödeme, stok ve paneli tek pakette verir; kendi sunucunuzda açık kaynak kurmak ise aylar süren bakım işi demektir. Türkiye'de satış yapanlar için ön ödemeli SaaS, ilk satışa en hızlı yoldur.",
    tip: "Mefticaret'te mağaza kurulumu dakikalar sürer: tema seçin, ürün ekleyin, ödemeyi bağlayın, satışa açın.",
  },
  {
    icon: Globe,
    title: "3. Alan adı ve vitrininizi hazırlayın",
    body: "Kısa, akılda kalıcı, .com veya .com.tr bir alan adı alın. Mağaza adınızı, logonuzu ve renklerinizi vitrine yansıtın. Her ürün için 3–5 fotoğraf, net başlık ve dürüst açıklama yazın; açıklama aynı zamanda Google'da bulunmanın temelidir.",
    tip: "Mefticaret ücretli paketlerinde özel alan adı bağlama ve otomatik SEO metatagları tek tıkla yapılır.",
  },
  {
    icon: CreditCard,
    title: "4. Ödemeyi ve kargoyu bağlayın",
    body: "Kartla tahsilat için sanal POS (3D Secure) veya ödeme kuruluşu bağlarsınız; havale/EFT ve kapıda ödeme alternatifleri dönüşümü artırır. Kargoda anlaşmalı kargo, otomatik takip numarası ve iade süreci müşteri memnuniyetinin bel kemiğidir.",
    tip: "Mefticaret QNBpay kart tahsilatı, IBAN'a havale ve Aras Kargo entegrasyonuyla siparişten teslimata kadar akışı otomatikleştirir.",
  },
  {
    icon: BarChart3,
    title: "5. İlk müşterinizi getirin ve ölçün",
    body: "Organik ziyaretçi ilk gün gelmez: Instagram, WhatsApp katalogları, çevreniz ve pazaryerleri ilk satış kanallarınızdır. Ziyaretçi geldikten sonra sepet terk oranı, en çok görüntülenen ürün ve dönüşüm oranını takip edin; veriye göre iyileştirin.",
    tip: "Mağaza içi analitik ekranlarıyla ciro, sipariş ve tekrar müşteri metriklerini izleyebilirsiniz.",
  },
];

const CHECKLIST = [
  "Satacağınız ürünler ve başlangıç stoğu",
  "Bir e-ticaret altyapısı (vitrin + panel + sepet)",
  "Alan adı (mefticaret.com/mağazanız veya kendi .com'unuz)",
  "Ödeme yöntemi: sanal POS / ödeme kuruluşu, havale-EFT",
  "Anlaşmalı kargo ve iade politikası",
  "Ürün fotoğrafları, fiyat ve stok bilgisi",
  "Vergi mükellefiyetinize uygun fatura düzeni (e-Arşiv/e-Fatura)",
  "İlk müşteri kanalı: Instagram, WhatsApp, pazaryeri veya reklam",
];

const COSTS = [
  {
    icon: Globe,
    item: "Alan adı",
    range: "300–800 TL/yıl",
    note: "Ücretsiz planda mefticaret.com alt adresi; özel .com ücretli paketlerde bağlanır.",
  },
  {
    icon: LayoutTemplate,
    item: "E-ticaret altyapısı",
    range: "0 TL'den itibaren",
    note: "Mefticaret ücretsiz paketle başlar; ücretli paketler aylık sabit ücret + düşen komisyon.",
  },
  {
    icon: CreditCard,
    item: "Ödeme komisyonu",
    range: "Satış başına %1–3",
    note: "Paket yükseldikçe Mefticaret işlem komisyonu düşer; kart tahsilat ücreti ayrıdır.",
  },
  {
    icon: Truck,
    item: "Kargo",
    range: "Gönderi başına değişken",
    note: "Anlaşmalı kargo tarifesi; masrafı müşteriye veya sepette sizin üzerinize yansıtabilirsiniz.",
  },
  {
    icon: BarChart3,
    item: "Pazarlama",
    range: "Bütçenize göre",
    note: "Organik Instagram/WhatsApp 0 TL ile başlar; reklam bütçesi sonra planlanır.",
  },
];

const CHANNELS = [
  {
    icon: Store,
    title: "Kendi e-ticaret siteniz",
    pros: [
      "Marka sizin: vitrin, alan adı ve müşteri verisi size aittir",
      "Komisyon yerine sabit altyapı ücreti; satış büyüdükçe birim maliyet düşer",
      "Google'da kendi ürün sayfalarınız indexlenir, organik trafik birikir",
      "İndirim, kupon, e-posta ve upsell kurallarını kısıtsız kurarsınız",
    ],
    cons: ["İlk ziyaretçiyi kendiniz getirirsiniz", "Güven ilk günlerde kurulum ister"],
  },
  {
    icon: Building2,
    title: "Pazaryerinde satış (Trendyol, Hepsiburada…)",
    pros: [
      "Hazır ziyaretçi trafiği; ilk satış hızlı gelir",
      "Ödeme ve altyapı pazaryerinin",
    ],
    cons: [
      "Satış başına yüksek komisyon",
      "Müşteri verisi pazaryerine kalır; tekrar satış zordur",
      "Fiyat savaşları ve kurallara bağımlılık",
    ],
  },
];

const FAQ = [
  {
    q: "E-ticaret yapmak için teknik bilgi gerekir mi?",
    a: "Hayır. Hazır bir e-ticaret platformunda vitrin, ürün ekleme, ödeme ve kargo ayarları panel üzerinden yapılır; kod yazmak gerekmez. Kendi sunucunuzu kurmak istiyorsanız teknik bilgi veya bir geliştirici gerekir.",
  },
  {
    q: "E-ticaret için neler gerekli?",
    a: "Satacağınız ürünler, bir e-ticaret altyapısı, alan adı, ödeme yöntemi (sanal POS veya havale), anlaşmalı kargo, ürün fotoğrafları ve ilk müşteri kanalı. Vergisel olarak satış hacminize göre e-Arşiv/e-Fatura düzeni kurmanız gerekir.",
  },
  {
    q: "E-ticaret ne kadar maliyeti olur?",
    a: "Mefticaret'te ücretsiz paketle 0 TL altyapı maliyetiyle başlayabilirsiniz. Ek maliyetler alan adı (300–800 TL/yıl), satış başına ödeme komisyonu ve kargo ücretidir; reklam bütçesi opsiyoneldir.",
  },
  {
    q: "Kendi sitem mi, pazaryeri mi daha iyi?",
    a: "İkisi birlikte en iyisidir. Pazaryeri hazır trafik verir ama komisyon ve müşteri verisi kaybı getirir; kendi siteniz komisyon avantajı ve marka sahipliği sağlar. Çoğu satıcı pazaryeriyle başlayıp kendi mağazasını büyütür.",
  },
  {
    q: "Evden, işletme kurmadan e-ticaret yapabilir miyim?",
    a: "Evet. Ev üretimi ürünleri (el örgüsü, yöresel gıda, takı vb.) Mefticaret'in bağımsız Kolay Panel'iyle e-posta girişiyle dakikalar içinde vitrine açabilir, WhatsApp veya kartla tahsilat yapabilirsiniz. Satışınız büyüdüğünde kurumsal panele aynı verilerle geçebilirsiniz.",
  },
];

function EcommerceHowToPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-16 lg:px-8 lg:py-24">
      <header className="mx-auto max-w-3xl text-center">
        <span className="eyebrow">Başlangıç rehberi</span>
        <h1 className="mt-6 text-3xl font-extrabold sm:text-4xl lg:text-5xl">
          E-ticaret nasıl yapılır?
        </h1>
        <p className="mt-5 text-muted-foreground">
          Ürün seçiminden ilk siparişe: e-ticaretin 5 adımını, gerekli her şeyi, gerçek
          maliyetleri ve "kendi sitem mi, pazaryeri mi" kararını tek rehberde topladık.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild className="rounded-full">
            <Link to="/auth" search={{ mode: "register" }}>
              Ücretsiz mağaza aç
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/e-ticaret-paketleri">Paketleri karşılaştır</Link>
          </Button>
        </div>
      </header>

      <section aria-labelledby="adimlar" className="mt-20">
        <h2 id="adimlar" className="text-2xl font-extrabold sm:text-3xl">
          E-ticaret 5 adımda yapılır
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((step) => (
            <article key={step.title} className="showcase-card flex flex-col p-7">
              <span className="inline-flex size-11 items-center justify-center rounded-xl bg-accent">
                <step.icon className="size-5 text-brand" aria-hidden />
              </span>
              <h3 className="mt-4 text-lg font-bold">{step.title}</h3>
              <p className="mt-3 flex-1 text-sm text-muted-foreground">{step.body}</p>
              {step.tip ? (
                <p className="mt-4 rounded-xl bg-accent px-4 py-3 text-xs text-foreground/80">
                  {step.tip}
                </p>
              ) : null}
            </article>
          ))}
          <article className="showcase-card flex flex-col justify-center p-7 text-center">
            <Scale className="mx-auto size-8 text-brand" aria-hidden />
            <h3 className="mt-4 text-lg font-bold">Bu adımlar 1 haftada atılır</h3>
            <p className="mt-3 text-sm text-muted-foreground">
              Ürünleriniz hazırsa Mefticaret'te vitrin kurulumu, ödeme ve kargo bağlantısı tek
              gün içinde tamamlanır.
            </p>
          </article>
        </div>
      </section>

      <section aria-labelledby="gerekli" className="mt-20 max-w-3xl">
        <h2 id="gerekli" className="text-2xl font-extrabold sm:text-3xl">
          E-ticaret için neler gerekli?
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Başlamadan önce elinizde bulunması gerekenler; listede eksik olanı tamamlayın.
        </p>
        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CHECKLIST.map((item) => (
            <li key={item} className="showcase-card flex items-start gap-3 p-4 text-sm">
              <span
                className="mt-1 size-2 shrink-0 rounded-full bg-brand"
                aria-hidden
              />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="maliyet" className="mt-20">
        <h2 id="maliyet" className="text-2xl font-extrabold sm:text-3xl">
          E-ticaret ne kadar tutar?
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          E-ticaretin gerçek maliyeti altyapı ücretinden çok satış başına kesinti ve kargodan
          gelir. 2026 için tipik kalem başına aralıklar:
        </p>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {COSTS.map((cost) => (
            <article key={cost.item} className="showcase-card p-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">{cost.item}</h3>
                <cost.icon className="size-5 text-brand" aria-hidden />
              </div>
              <p className="mt-3 font-display text-xl font-extrabold text-brand">{cost.range}</p>
              <p className="mt-2 text-xs text-muted-foreground">{cost.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="kanal-karari" className="mt-20">
        <h2 id="kanal-karari" className="text-2xl font-extrabold sm:text-3xl">
          Kendi sitem mi, pazaryeri mi?
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Karar "ya da" değil, sıra meselesidir. İki kanalın güçlü ve zorlu yanlarını karşılaştırın:
        </p>
        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {CHANNELS.map((channel) => (
            <article key={channel.title} className="showcase-card p-7">
              <div className="flex items-center gap-3">
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-accent">
                  <channel.icon className="size-5 text-brand" aria-hidden />
                </span>
                <h3 className="text-lg font-bold">{channel.title}</h3>
              </div>
              <ul className="mt-5 space-y-2 text-sm">
                {channel.pros.map((pro) => (
                  <li key={pro} className="flex gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-success" aria-hidden />
                    <span>{pro}</span>
                  </li>
                ))}
              </ul>
              <ul className="mt-4 space-y-2 border-t pt-4 text-sm text-muted-foreground">
                {channel.cons.map((con) => (
                  <li key={con} className="flex gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden />
                    <span>{con}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <p className="mt-6 max-w-3xl text-sm text-muted-foreground">
          Mefticaret'te iki kanalı birlikte yönetebilirsiniz: pazaryeri entegrasyonu stok ve
          fiyatları tek panelden senkron tutar, kendi mağazanız marka değerini ve müşteri
          verinizi biriktirir.
        </p>
      </section>

      <section aria-labelledby="sss" className="mt-20 max-w-3xl">
        <h2 id="sss" className="text-2xl font-extrabold sm:text-3xl">
          Sık sorulan sorular
        </h2>
        <dl className="mt-6 space-y-6">
          {FAQ.map((item) => (
            <div key={item.q} className="showcase-card p-6">
              <dt className="font-semibold">{item.q}</dt>
              <dd className="mt-2 text-sm text-muted-foreground">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-20 showcase-card px-6 py-14 text-center">
        <h2 className="text-2xl font-extrabold sm:text-3xl">
          Rehberi okudunuz, sıra mağazayı açmada
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-sm text-muted-foreground">
          Ücretsiz paketle bugün vitrininizi kurun; ilk ürününüzü dakikalar içinde satışa açın.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="rounded-full">
            <Link to="/auth" search={{ mode: "register" }}>
              Ücretsiz başla
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="rounded-full">
            <Link to="/e-ticaret-sitesi-kurma">Adım adım kurulum rehberi</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
