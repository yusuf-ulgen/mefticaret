import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/mefti";
import { plansQuery } from "@/lib/store-queries";

const TITLE = "E-Ticaret Sitesi Kurma Maliyeti 2026: Kalem Kalem Hesap | Mefticaret";
const DESCRIPTION =
  "E-ticaret sitesi kurma maliyeti 2026: alan adı, altyapı, ödeme komisyonu, kargo, tasarım ve reklam giderlerini kalem kalem öğrenin; bütçenizi doğru planlayın.";
const URL = "https://mefticaret.com/e-ticaret-maliyeti";

const FAQ = [
  {
    q: "E-ticaret sitesi kurmak için ne kadar para gerekir?",
    a: "Hazır bir altyapıyla başlarsanız ilk gün için zorunlu gider genellikle sadece paket ücreti ve isteğe bağlı alan adıdır. Ödeme komisyonu ve kargo satış yaptıkça oluşur. Reklam bütçesini siz belirlersiniz.",
  },
  {
    q: "Ücretsiz e-ticaret sitesi açılabilir mi?",
    a: "Evet. Mefticaret'in ücretsiz paketiyle mağazanızı açıp ilk siparişlerinizi alabilirsiniz. Satış büyüdükçe ücretli pakete geçersiniz; verileriniz korunur.",
  },
  {
    q: "Hazır altyapı mı, yazılımcıya sıfırdan site mi daha ucuz?",
    a: "Sıfırdan yazılan sitede geliştirme, sunucu, güvenlik ve bakım ücretlerini ayrı ayrı ödersiniz. Hazır altyapıda bunlar aylık paket ücretine dahildir; bu yüzden başlangıç maliyeti çoğu zaman çok daha düşüktür.",
  },
  {
    q: "Hangi giderler satış yaptıkça artar?",
    a: "Ödeme kuruluşunun işlem komisyonu, kargo ücretleri, paketleme ve pazaryeri komisyonları satış adedine göre artar. Bunları ürün fiyatınıza eklemeyi unutmayın.",
  },
];

const ITEMS: { title: string; type: string; body: string }[] = [
  {
    title: "Alan adı (domain)",
    type: "Yıllık",
    body: "magazaniz.com gibi bir adres her yıl yenilenir. Ücreti uzantıya (.com, .com.tr) ve firmaya göre değişir. İsterseniz başlangıçta ücretsiz mefticaret.com adresinizi kullanabilirsiniz.",
  },
  {
    title: "E-ticaret altyapısı ve barındırma",
    type: "Aylık veya yıllık",
    body: "Sitenin çalıştığı sunucu, güvenlik sertifikası (SSL), yedekleme ve güncellemeler. Mefticaret'te bunların hepsi paket ücretine dahildir, ayrıca hosting almazsınız.",
  },
  {
    title: "Ödeme komisyonu",
    type: "Satış başına",
    body: "Kartla alınan ödemelerde ödeme kuruluşu (iyzico, PayTR vb.) her işlemden komisyon keser. Oranı kendi anlaşmanıza göre değişir. Platformun kendi işlem komisyonu aşağıdaki paket tablosunda yazıyor.",
  },
  {
    title: "Kargo ve paketleme",
    type: "Sipariş başına",
    body: "Kargo firmasıyla yaptığınız anlaşmaya ve paketin desisine göre değişir. Kutu, poşet ve etiket gibi paketleme malzemelerini de hesaba katın.",
  },
  {
    title: "Tasarım ve tema",
    type: "Tek seferlik / isteğe bağlı",
    body: "Hazır temalar ücretsizdir. Özel tasarım veya ürün fotoğrafçılığı isterseniz bir defaya mahsus ek gider çıkar.",
  },
  {
    title: "Reklam ve pazarlama",
    type: "Siz belirlersiniz",
    body: "Google, Instagram ve Facebook reklamları için günlük bütçeyi kendiniz ayarlarsınız. Küçük bir bütçeyle test edip işe yarayan kanala yatırımı artırmak en güvenli yoldur.",
  },
  {
    title: "Muhasebe ve e-fatura",
    type: "Aylık",
    body: "Şirket türünüze göre mali müşavir ve e-fatura/e-arşiv hizmeti gerekir. Ücretleri hizmet aldığınız firmaya göre değişir.",
  },
];

export const Route = createFileRoute("/e-ticaret-maliyeti")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
      { property: "og:locale", content: "tr_TR" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Article",
              headline: "E-Ticaret Sitesi Kurma Maliyeti 2026",
              description: DESCRIPTION,
              url: URL,
              inLanguage: "tr-TR",
              publisher: { "@type": "Organization", name: "Mefticaret", url: "https://mefticaret.com" },
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Ana sayfa", item: "https://mefticaret.com/" },
                { "@type": "ListItem", position: 2, name: "E-ticaret sitesi kurma maliyeti", item: URL },
              ],
            },
          ],
        }),
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(plansQuery()).catch(() => null),
  component: CostGuidePage,
});

function CostGuidePage() {
  const { data: plans } = useQuery(plansQuery());
  const list = (plans ?? []).filter((plan) => plan.is_active !== false);

  return (
    <main className="mx-auto max-w-4xl px-4 py-16 lg:py-24">
      <nav aria-label="Konum" className="text-xs text-muted-foreground">
        <Link to="/" className="hover:underline">Ana sayfa</Link> / E-ticaret sitesi kurma maliyeti
      </nav>
      <header className="mt-6">
        <span className="eyebrow">Maliyet rehberi · 2026</span>
        <h1 className="mt-6 text-3xl font-extrabold sm:text-4xl lg:text-5xl">E-ticaret sitesi kurma maliyeti</h1>
        <p className="mt-5 text-lg text-muted-foreground">
          Bir online mağazanın maliyeti üç gruptan oluşur: başlarken bir defa ödenenler, her ay ödenenler ve satış
          yaptıkça artanlar. Aşağıda her kalemi ve neyin zorunlu, neyin isteğe bağlı olduğunu anlatıyoruz.
        </p>
      </header>

      <section aria-labelledby="kalemler" className="mt-14">
        <h2 id="kalemler" className="text-2xl font-extrabold sm:text-3xl">Gider kalemleri</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {ITEMS.map((item) => (
            <article key={item.title} className="showcase-card p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand">{item.type}</p>
              <h3 className="mt-2 text-base font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="paketler" className="mt-16">
        <h2 id="paketler" className="text-2xl font-extrabold sm:text-3xl">Mefticaret altyapı ücretleri</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Fiyatlar güncel paket listemizden otomatik gelir. Hosting, SSL ve güncellemeler dahildir.
        </p>
        <div className="mt-6 overflow-x-auto rounded-2xl border">
          <table className="w-full min-w-[520px] text-sm">
            <caption className="sr-only">Mefticaret paket ücretleri</caption>
            <thead className="bg-muted/50 text-left">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Paket</th>
                <th scope="col" className="px-4 py-3 font-semibold">Aylık</th>
                <th scope="col" className="px-4 py-3 font-semibold">Yıllık</th>
                <th scope="col" className="px-4 py-3 font-semibold">Platform komisyonu</th>
              </tr>
            </thead>
            <tbody>
              {list.map((plan) => (
                <tr key={plan.id} className="border-t">
                  <th scope="row" className="px-4 py-3 font-medium">{plan.name}</th>
                  <td className="px-4 py-3">
                    {Number(plan.price_monthly) > 0 ? formatMoney(Number(plan.price_monthly), plan.currency) : "Ücretsiz"}
                  </td>
                  <td className="px-4 py-3">
                    {Number(plan.price_yearly) > 0 ? formatMoney(Number(plan.price_yearly), plan.currency) : "—"}
                  </td>
                  <td className="px-4 py-3">%{(Number(plan.commission_rate) * 100).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Link to="/e-ticaret-paketleri" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
          Paketlerin tüm özelliklerini karşılaştırın <ArrowRight className="size-4" />
        </Link>
      </section>

      <section aria-labelledby="ipuclari" className="mt-16">
        <h2 id="ipuclari" className="text-2xl font-extrabold sm:text-3xl">Maliyeti düşük tutmak için</h2>
        <ul className="mt-6 space-y-3 text-sm">
          {[
            "Ücretsiz paketle başlayın, satış geldikçe paketi yükseltin.",
            "Kargo ve ödeme komisyonunu ürün fiyatınıza dahil edin.",
            "Hazır tema kullanın; tasarıma ilk günden para harcamayın.",
            "Reklamı küçük bir bütçeyle test edin, işe yarayan kanala odaklanın.",
            "Pazaryeri entegrasyonuyla aynı ürünleri ek maliyet olmadan farklı kanallarda satın.",
          ].map((tip) => (
            <li key={tip} className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-success" />
              {tip}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="sss" className="mt-16">
        <h2 id="sss" className="text-2xl font-extrabold sm:text-3xl">Sık sorulan sorular</h2>
        <div className="mt-6 divide-y rounded-2xl border">
          {FAQ.map((item) => (
            <details key={item.q} className="p-5">
              <summary className="cursor-pointer font-medium">{item.q}</summary>
              <p className="mt-3 text-sm text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-16 rounded-3xl border bg-card p-8 text-center">
        <h2 className="text-2xl font-extrabold">Ücretsiz başlayın</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Mağazanızı bugün açın; ilk siparişinizi almadan ücret ödemeyin.
        </p>
        <Button asChild className="mt-6 rounded-full">
          <Link to="/auth" search={{ mode: "register" }}>Mağazamı aç <ArrowRight className="size-4" /></Link>
        </Button>
        <p className="mt-4 text-xs text-muted-foreground">
          Adım adım kurulum için: <Link to="/e-ticaret-sitesi-kurma" className="underline">E-ticaret sitesi kurma rehberi</Link>
        </p>
      </section>
    </main>
  );
}
