import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  FileJson,
  Globe,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  Store,
  Truck,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const TITLE = "Dropshipping Nasıl Yapılır? 2026 Rehberi — XML/API ile Otomasyon";
const DESCRIPTION =
  "Dropshipping nasıl yapılır? Tedarikçi seçiminden XML/API entegrasyonuna, stok senkronizasyonundan kargo ve iade süreçlerine kadar adım adım rehber.";
const URL = "https://mefticaret.com/dropshipping-nasil-yapilir";

export const Route = createFileRoute("/dropshipping-nasil-yapilir")({
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
          headline: "Dropshipping Nasıl Yapılır? 2026 Rehberi",
          description: DESCRIPTION,
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
            { "@type": "ListItem", position: 2, name: "Dropshipping nasıl yapılır", item: URL },
          ],
        }),
      },
    ],
  }),
  component: DropshippingGuidePage,
});

const STEPS = [
  {
    icon: Store,
    title: "1. Niş ve satış kanalını belirleyin",
    body: "Dropshipping'de kârlılık, dar ve talep gören bir ürün segmentiyle başlar. Spor, ev yaşamı, bebek, hobi veya elektronik aksesuar gibi alanlarda rekabeti ve tedarik süresini analiz edin. Hedef kanalınız kendi siteniz mi, pazaryeri mi, yoksa ikisi birden mi olacak?",
    tip: "Mefticaret'te tek hesapla birden fazla mağaza ve pazaryeri kanalı açabilir; her kanal aynı stok havuzundan beslenir.",
  },
  {
    icon: Boxes,
    title: "2. Güvenilir tedarikçi bulun",
    body: "Tedarikçinin stok güncelleme sıklığı, kargo süresi, iade politikası ve toptan fiyat listesi kritiktir. Türkiye içinse İstanbul/İzmir merkezli toptancıları, globalde ise doğrulanmış B2B supplier dizinlerini değerlendirin. Mutlaka numune sipariş verin.",
    tip: "Tedarikçi kartlarında iletişim, sözleşme, minimum sipariş ve ortalama kargo süresi saklanır; performansı dönemsel olarak değerlendirebilirsiniz.",
  },
  {
    icon: FileJson,
    title: "3. XML veya API bağlantısı kurun",
    body: "Tedarikçinin ürün, stok ve fiyat verisini otomatik çekmek için XML feed veya REST API bağlantısı şart. Manuel güncelleme hem hata riski yüksektir hem de stoksuz satışa yol açar.",
    tip: "Mefticaret XML Entegratörü ile farklı formattaki XML/JSON feed'leri eşleştirir, kategori eşleme yapar ve saatlik otomatik senkronizasyon çalıştırır.",
  },
  {
    icon: RefreshCw,
    title: "4. Stok ve fiyat senkronizasyonunu otomatikleştirin",
    body: "Tedarikçi stok sıfırlandığında vitrindeki ürün otomatik pasife düşmeli, fiyat değiştiğinde kâr marjınız korunmalı. Kur değişimleri varsa otomatik kur çarpanı ve minimum marj kuralı tanımlayın.",
    tip: "Stok kuralları ve minimum marj koruması sayesinde fiyat değişimleri veya kur hareketleri sizi zarara sokmadan otomatik güncellenir.",
  },
  {
    icon: Zap,
    title: "5. Ürün içeriklerini optimize edin",
    body: "Tedarikçinin standart görselleri ve açıklamalarıyla yetinmeyin; özgün başlık, açıklama, kategori ve SEO etiketleriyle farklılaşın. Çok varyantlı ürünlerde beden, renk ve barkod bilgilerini eksiksiz taşıyın.",
    tip: "AI ürün açıklaması ve kategori stüdyosu, toplu düzenleme ve XML'den gelen içeriği otomatik zenginleştirmenizi sağlar.",
  },
  {
    icon: Globe,
    title: "6. Satış kanallarını yayına alın",
    body: "Kendi vitrininizin yanı sıra Trendyol, Hepsiburada, Amazon gibi pazaryerlerinde listeleyin. Her kanal için ayrı fiyat ve komisyon oranı tanımlayın; stok yine tek havuzdan düşsün.",
    tip: "Omni-Channel modülü ve pazaryeri operasyonu sayesinde tüm kanallar merkezi yönetilir, ceza almayacak şekilde senkronize kalır.",
  },
  {
    icon: Truck,
    title: "7. Sipariş ve kargo akışını otomatikleştirin",
    body: "Müşteri siparişi geldiğinde tedarikçiye otomatik sipariş dosyası veya API bildirimi gönderin. Kargo takip numarasını sisteme yansıtın ve müşteriye otomatik bildirim atın.",
    tip: "Visual Automation Builder ile sipariş → tedarikçi bildirimi → kargo etiketi → müşteri SMS/e-posta zincirini kod yazmadan kurabilirsiniz.",
  },
  {
    icon: ShieldCheck,
    title: "8. İade ve müşteri hizmetleri süreçlerini hazırlayın",
    body: "Dropshipping'de iade genellikle tedarikçi adresine yapılır. Net iade politikası, iade talep formu ve otomatik stok iade akışı müşteri güveni için zorunludur.",
    tip: "İade onayı sonrası ürün otomatik stoğa geri ekilir; iade tutarı ve durumu sadece yetkili personel tarafından güncellenir.",
  },
  {
    icon: BarChart3,
    title: "9. Kârlılığı izleyin ve ölçeklendirin",
    body: "Her ürün için maliyet, komisyon, kargo, ödeme komisyonu ve reklam maliyetini çıkararak net kârı hesaplayın. Kârsız ürünleri pasife alın, yüksek marjlıları öne çıkarın.",
    tip: "Detaylı raporlar ve AI rakip fiyat analizi ile hangi ürünün ne kadar kâr ettiğini ürün bazında görebilirsiniz.",
  },
  {
    icon: PackageCheck,
    title: "10. Yasal uyumu ve sözleşmeleri tamamlayın",
    body: "Tedarikçi sözleşmesi, mesafeli satış sözleşmesi, iade politikası, KVKK aydınlatma metni ve fatura düzeni dropshipping'de özellikle önemlidir.",
    tip: "AI hukuki içerik asistanı ve hazır şablonlarla e-ticaret ve dropshipping için gerekli dokümanları hızla oluşturabilirsiniz.",
  },
];

const MISTAKES = [
  "Stok güncellemesi yapmadan ürün satışa çıkarmak ve stoksuz sipariş almak.",
  "Tedarikçiyle yazılı sözleşme yapmadan yüksek hacimli satış yapmak.",
  "Tüm kanallarda aynı fiyatı kullanmak; pazaryeri komisyonlarını hesaba katmamak.",
  "Uzun veya belirsiz kargo sürelerini müşteriye şeffaf şekilde bildirmemek.",
  "İade sürecini manuel ve yavaş yönetmek; müşteri memnuniyetini düşürmek.",
];

const FAQS = [
  {
    q: "Dropshipping yapmak için stok tutmama gerek var mı?",
    a: "Hayır, dropshipping'in temel avantajı stoksuz satıştır. Ürünü tedarikçiden sipariş aldıktan sonra doğrudan müşteriye gönderirsiniz. Ancak stok ve fiyat verisini anlık takip etmeniz şart.",
  },
  {
    q: "XML entegrasyonu ne işe yarar?",
    a: "Tedarikçinin ürün, stok ve fiyat bilgisini otomatik olarak sitenize çeker. Manuel güncelleme hatalarını ve stoksuz satış riskini ortadan kaldırır.",
  },
  {
    q: "Pazaryerlerinde dropshipping yapabilir miyim?",
    a: "Evet, ancak her pazar yerinin kendi kural ve komisyon yapısı vardır. Stok ve fiyat senkronizasyonunu merkezi bir panelden yönetmek ceza riskini azaltır.",
  },
  {
    q: "Dropshipping'de kâr marjı nasıl korunur?",
    a: "Otomatik fiyatlandırma kuralları, minimum marj koruması, kur çarpanı ve komisyon hesaplaması ile her satışın kârlı kalmasını sağlayabilirsiniz.",
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

function DropshippingGuidePage() {
  return (
    <main className="min-h-screen">
      <section className="border-b bg-background px-6 py-16 lg:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 inline-flex items-center rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand">
            2026 dropshipping rehberi
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Dropshipping Nasıl Yapılır?
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Tedarikçi seçiminden XML/API entegrasyonuna, otomatik stok senkronizasyonundan kargo ve iade
            süreçlerine kadar dropshipping işini adım adım kurun.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="rounded-full">
              <a href="/auth">
                Ücretsiz başla
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </a>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-full">
              <Link to="/e-ticaret-sitesi-kurma">E-ticaret rehberi</Link>
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
          <h2 className="text-2xl font-semibold tracking-tight">Yaygın dropshipping hataları</h2>
          <p className="mt-2 text-muted-foreground">
            Bu listeyi operasyonunuzu kurarken ve ölçeklerken kontrol listesi olarak kullanın.
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
            Dropshipping operasyonunu tek panelden yönet
          </h2>
          <p className="mt-4 text-lg opacity-90">
            XML entegratörü, otomatik stok senkronizasyonu, pazaryeri operasyonu ve kargo/iade akışlarıyla
            dropshipping işini kurumsal bir düzene oturt.
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
