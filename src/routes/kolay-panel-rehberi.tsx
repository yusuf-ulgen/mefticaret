import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Bell,
  CreditCard,
  LayoutTemplate,
  LogIn,
  Package,
  ShoppingBag,
  Store,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const TITLE = "Kolay Panel Rehberi: Mağaza Aç, Ürün Yükle, İlk Siparişi Al";
const DESCRIPTION =
  "Kolay Panel'e girişten sonra adım adım: mağaza açma, vitrin/tema kurulumu, ürün yükleme, ödeme ayarı ve ilk siparişin nasıl işleneceği. Ev üretimi satıcılar için Türkçe rehber.";
const URL = "https://mefticaret.com/kolay-panel-rehberi";

const TOC = [
  { href: "#giris", label: "1. Giriş yap" },
  { href: "#magaza", label: "2. Mağazayı aç" },
  { href: "#vitrin", label: "3. Vitrini kur" },
  { href: "#urun", label: "4. Ürün yükle" },
  { href: "#odeme", label: "5. Ödemeyi ayarla" },
  { href: "#siparis", label: "6. İlk sipariş" },
];

const STEPS: { id: string; icon: typeof Store; title: string; body: string; bullets: string[] }[] =
  [
    {
      id: "giris",
      icon: LogIn,
      title: "1. Kolay Panel'e giriş yap",
      body: "Kolay Panel'e telefonuna gönderilen doğrulama koduyla veya e-posta ve şifreyle giriş yapabilirsin. Hesabın yoksa aynı ekrandan kayıt olabilirsin.",
      bullets: [
        "Telefonla giriş için numaranı yaz, kod iste ve gelen doğrulama kodunu gir.",
        "E-posta ile giriş seçeneğinde e-postanı ve şifreni yaz.",
        "İlk kez giriyorsan 'Hesap oluştur' sekmesinden adını, e-postanı ve en az 8 karakterli şifreni gir.",
        "E-posta onay bağlantısı geldiğinde tıkla; sonra giriş ekranına dön.",
        "Şifreni unuttuysan aynı ekrandaki 'Şifremi unuttum' bağlantısını kullan.",
      ],
    },
    {
      id: "magaza",
      icon: Store,
      title: "2. Mağazanı aç",
      body: "Giriş yaptıktan sonra kurulum ekranı açılır. Mağaza adı ve ürün kategorini seçtiğin anda mağazan ve vitrin adresin otomatik oluşur.",
      bullets: [
        "Mağaza adını yaz (ör. 'Ayşe'nin El Örgüsü'). Vitrin adresi bu addan üretilir.",
        "Kategori seç: el emeği örgü, yöresel gıda, takı, ev kozmetiği gibi.",
        "Kurulum bitince Kolay Panel'in 'Mağazam' sekmesine düşersin.",
        "Kolay Panel mağazaları kurumsal paketlerden bağımsızdır; ücretli paket seçmen gerekmez.",
      ],
    },
    {
      id: "vitrin",
      icon: LayoutTemplate,
      title: "3. Vitrini kur ve yayına al",
      body: "Vitrin, müşterinin gördüğü mağaza sayfandır. Logo, kısa tanıtım ve iletişim bilgisi eklediğinde profesyonel görünür.",
      bullets: [
        "Logo veya profil fotoğrafı yükle; yuvarlak alanda görünür.",
        "Bir iki cümlelik tanıtım yaz: ne ürettiğin ve hangi şehirde olduğun.",
        "WhatsApp numaranı ekle; müşteriler tek dokunuşla yazabilir.",
        "Üst taraftaki durum düğmesini 'Canlı' yap; 'Bakımda' iken vitrin sipariş almaz.",
      ],
    },
    {
      id: "urun",
      icon: Package,
      title: "4. İlk ürününü yükle",
      body: "Ürünlerim sekmesinden ürün eklersin. Fotoğraf, fiyat ve stok girdiğin anda vitrinde görünür.",
      bullets: [
        "Fotoğrafı telefonundan çek; arka planı temizlemek için yapay zekâ aracını kullanabilirsin.",
        "Ürün adı, fiyat ve stok adedi gir. Hazırlık süresi yazarsan müşteri kaç günde geleceğini bilir.",
        "Açıklama yazmakta zorlanırsan yapay zekâ açıklama aracına ürün adını söyle.",
        "Kaydettiğin anda ürün vitrinde ve ürün listesi sayfasında yayınlanır.",
      ],
    },
    {
      id: "odeme",
      icon: CreditCard,
      title: "5. Tahsilat yöntemini ayarla",
      body: "Müşterinin ödemeyi nasıl yapacağını seçersin: kartla online ödeme veya havale/WhatsApp ile anlaşma.",
      bullets: [
        "Kartla tahsilat açıksa müşteri 'Hemen satın al' ile doğrudan ödeme sayfasına gider.",
        "Kart kapalıysa IBAN ve hesap sahibi adını yaz; vitrinde havale bilgisi ve WhatsApp bağlantısı gösterilir.",
        "Günlük sipariş kapasitesi belirleyebilirsin; dolduğunda mağaza o gün yeni sipariş almaz.",
        "Kazançlarını 'Mağazam' üstündeki kazanç şeridinden takip edersin.",
      ],
    },
    {
      id: "siparis",
      icon: ShoppingBag,
      title: "6. İlk siparişin geldiğinde",
      body: "Sipariş geldiğinde panelde bildirim çıkar, istersen sesli uyarı okur. Siparişler sekmesinden adım adım ilerletirsin.",
      bullets: [
        "Siparişi 'Hazırlanıyor' yap; müşteriye durum bilgisi gider.",
        "Kargoya vereceksen kargo kodu üret; elden teslim edeceksen teslim kodunu müşteriden iste.",
        "WhatsApp veya telefonla gelen siparişleri de 'Elle sipariş' ile aynı listeye kaydet.",
        "Teslim edilen siparişler kazanç ve raporlara otomatik işlenir.",
      ],
    },
  ];

const FAQ = [
  {
    q: "Kolay Panel için ücretli paket almam gerekiyor mu?",
    a: "Hayır. Kolay Panel mağazaları kurumsal paketlerden tamamen bağımsızdır; giriş yapıp mağazanı açabilir, ürün yükleyip satış yapabilirsin.",
  },
  {
    q: "Vitrin adresimi nerede bulurum?",
    a: "Mağazam sekmesinde vitrin bağlantısı ve paylaş düğmesi bulunur. Bağlantıyı WhatsApp durumunda, Instagram profilinde veya QR kodla paylaşabilirsin.",
  },
  {
    q: "Ürünüm vitrinde hemen görünür mü?",
    a: "Evet. Fiyat, stok ve açıklama değişiklikleri vitrine ve telefondaki ürün sayfasına anında yansır.",
  },
  {
    q: "Sipariş geldiğini nasıl anlarım?",
    a: "Panelin üstündeki zil simgesinde bildirim çıkar, ekranda uyarı görünür ve sesli bildirim ayarı açıksa sipariş sesli okunur.",
  },
];

export const Route = createFileRoute("/kolay-panel-rehberi")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "content-language", content: "tr" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
      { property: "og:locale", content: "tr_TR" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "canonical", href: URL },
      { rel: "alternate", hrefLang: "tr", href: URL },
      { rel: "alternate", hrefLang: "x-default", href: URL },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: "Kolay Panel'de mağaza açma ve ilk sipariş",
          description: DESCRIPTION,
          inLanguage: "tr-TR",
          totalTime: "PT1H",
          step: STEPS.map((step, index) => ({
            "@type": "HowToStep",
            position: index + 1,
            name: step.title.replace(/^\d+\.\s*/, ""),
            text: step.body,
            url: `${URL}#${step.id}`,
          })),
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Ana sayfa",
              item: "https://mefticaret.com/",
            },
            { "@type": "ListItem", position: 2, name: "Kolay Panel rehberi", item: URL },
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
  component: KolayPanelGuidePage,
});

function KolayPanelGuidePage() {
  return (
    <main className="bg-background">
      <section className="border-b">
        <div className="mx-auto max-w-4xl px-4 py-16 lg:px-8 lg:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Kolay Panel rehberi
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Girişten ilk siparişe: Kolay Panel'de mağaza açma rehberi
          </h1>
          <p className="mt-4 text-base text-muted-foreground">
            Bu rehber Kolay Panel'e giriş yaptıktan sonraki altı adımı sırayla anlatır: mağazanı
            açmak, vitrini kurmak, ürün yüklemek, tahsilat yöntemini seçmek ve ilk siparişi teslim
            etmek.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/ev-hanimlari">
                Kolay Panel girişi
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/e-ticaret-nasil-yapilir">E-ticaret nasıl yapılır?</Link>
            </Button>
          </div>
          <nav aria-label="Bu rehberde" className="mt-10 rounded-2xl border bg-card p-5">
            <p className="text-sm font-semibold">Bu rehberde</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {TOC.map((item) => (
                <li key={item.href}>
                  <a href={item.href} className="text-sm text-muted-foreground hover:text-primary">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-14 lg:px-8">
        <div className="grid gap-8">
          {STEPS.map((step) => (
            <article key={step.id} id={step.id} className="scroll-mt-24 rounded-2xl border p-6">
              <div className="flex items-start gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-primary">
                  <step.icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold">{step.title}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
                  <ul className="mt-4 grid gap-2">
                    {step.bullets.map((bullet) => (
                      <li key={bullet} className="text-sm text-muted-foreground">
                        • {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y bg-card">
        <div className="mx-auto max-w-4xl px-4 py-14 lg:px-8">
          <div className="flex items-center gap-3">
            <Bell className="size-5 text-primary" />
            <h2 className="text-2xl font-semibold">Sık sorulan sorular</h2>
          </div>
          <div className="mt-6 grid gap-4">
            {FAQ.map((item) => (
              <div key={item.q} className="rounded-2xl border bg-background p-5">
                <h3 className="font-semibold">{item.q}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-14 text-center lg:px-8">
        <h2 className="text-2xl font-semibold">Mağazanı bugün açabilirsin</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
          Kolay Panel telefondan çalışır; mağaza, ürün ve sipariş yönetimi tek ekranda toplanır.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/ev-hanimlari">Ücretsiz mağaza aç</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/e-ticaret-sitesi-kurma">E-ticaret sitesi kurma</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
