import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, Check, Minus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatMoney, planLimitLabel } from "@/lib/mefti";
import { plansQuery } from "@/lib/store-queries";

const TITLE = "E-Ticaret Paketleri ve Fiyatları 2026 — Mefticaret Karşılaştırma";
const DESCRIPTION =
  "Mefticaret e-ticaret paketleri: ücretsiz plandan kurumsal ölçeğe kadar fiyat, ürün ve sipariş limitleri, komisyon oranları ve özellikleri tek tabloda karşılaştırın.";
const URL = "https://mefticaret.com/e-ticaret-paketleri";

export const Route = createFileRoute("/e-ticaret-paketleri")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Ana sayfa", item: "https://mefticaret.com/" },
            { "@type": "ListItem", position: 2, name: "E-ticaret paketleri", item: URL },
          ],
        }),
      },
    ],
  }),
  component: PlansPage,
});

const FAQ = [
  {
    q: "Hangi e-ticaret paketi bana uygun?",
    a: "Aylık sipariş adediniz 50'nin altındaysa Ücretsiz paketle test edin. Özel alan adı ve kupon gerekiyorsa Başlangıç, pazaryeri entegrasyonları ve AI araçları gerekiyorsa Profesyonel, çoklu depo ve gelişmiş raporlar gerekiyorsa Business paketi uygundur.",
  },
  {
    q: "Paket yükseltmesinde verilerim korunur mu?",
    a: "Evet. Ürün, sipariş, müşteri ve tema verileriniz aynı mağazada kalır; yalnızca limitler ve özellikler açılır.",
  },
  {
    q: "Yıllık ödemede avantaj var mı?",
    a: "Yıllık ödemede ücretli paketlerde 12 ay yerine 10 ay ödersiniz; fiyat tablosunda aylık karşılığını görebilirsiniz.",
  },
  {
    q: "Komisyon oranı nedir?",
    a: "Her paketin kendi işlem komisyonu vardır ve paket yükseldikçe oran düşer. Oranları aşağıdaki karşılaştırma tablosunda görebilirsiniz.",
  },
];

const LIMIT_ROWS = [
  { key: "products", label: "Ürün" },
  { key: "orders", label: "Aylık sipariş" },
  { key: "staff", label: "Personel" },
  { key: "domains", label: "Özel alan adı" },
  { key: "apps", label: "Uygulama" },
  { key: "ai_credits", label: "AI kredisi" },
] as const;

function PlansPage() {
  const { data: plans } = useQuery(plansQuery());
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const list = plans ?? [];

  const priceOf = (plan: (typeof list)[number]) =>
    interval === "yearly" ? Number(plan.price_yearly ?? 0) : Number(plan.price_monthly ?? 0);

  return (
    <main className="mx-auto max-w-7xl px-4 py-16 lg:px-8 lg:py-24">
      <header className="mx-auto max-w-3xl text-center">
        <span className="eyebrow">E-ticaret paketleri</span>
        <h1 className="mt-6 text-3xl font-extrabold sm:text-4xl lg:text-5xl">
          E-ticaret paketleri ve fiyatları
        </h1>
        <p className="mt-5 text-muted-foreground">
          Mefticaret paketlerini fiyat, limit, komisyon ve özellik bazında karşılaştırın. Kurulum
          ücreti yoktur; dilediğiniz zaman paket yükseltip düşürebilirsiniz.
        </p>
        <div
          role="group"
          aria-label="Ödeme dönemi"
          className="mx-auto mt-8 inline-flex rounded-full border bg-card p-1"
        >
          {(["monthly", "yearly"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={interval === option}
              onClick={() => setInterval(option)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition ${
                interval === option
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {option === "monthly" ? "Aylık" : "Yıllık"}
            </button>
          ))}
        </div>
      </header>

      <section aria-labelledby="paket-kartlari" className="mt-14">
        <h2 id="paket-kartlari" className="sr-only">
          Paket fiyatları
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          {list.map((plan) => {
            const limits = (plan.limits ?? {}) as Record<string, number>;
            const features = Array.isArray(plan.features) ? (plan.features as string[]) : [];
            const featured = plan.code === "professional";
            const price = priceOf(plan);
            return (
              <article
                key={plan.id}
                data-featured={featured}
                className="showcase-card flex flex-col p-6 data-[featured=true]:border-brand data-[featured=true]:ring-1 data-[featured=true]:ring-brand/30"
              >
                <h3 className="text-base font-semibold">{plan.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>
                <p className="mt-5 font-display text-2xl font-extrabold">
                  {price === 0 ? "Ücretsiz" : formatMoney(price, plan.currency)}
                  {price > 0 ? (
                    <span className="text-sm font-medium text-muted-foreground">
                      {interval === "yearly" ? "/yıl" : "/ay"}
                    </span>
                  ) : null}
                </p>
                {interval === "yearly" && Number(plan.price_yearly ?? 0) > 0 ? (
                  <p className="mt-1 text-xs text-success">
                    Aylık {formatMoney(Number(plan.price_yearly) / 12, plan.currency)} karşılığı
                  </p>
                ) : null}
                <ul className="mt-5 space-y-2 text-sm">
                  <li className="flex gap-2">
                    <Check className="mt-0.5 size-4 text-success" />
                    <span>{planLimitLabel(limits["products"])} ürün</span>
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-0.5 size-4 text-success" />
                    <span>{planLimitLabel(limits["orders"])} sipariş</span>
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-0.5 size-4 text-success" />
                    <span>%{(Number(plan.commission_rate) * 100).toFixed(1)} komisyon</span>
                  </li>
                  {features.slice(0, 4).map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <Check className="mt-0.5 size-4 text-success" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                {plan.trial_days > 0 ? (
                  <p className="mt-3 text-xs text-muted-foreground">{plan.trial_days} gün deneme</p>
                ) : null}
                <Button
                  asChild
                  className="mt-6 w-full rounded-full"
                  variant={featured ? "default" : "outline"}
                >
                  <Link to="/auth" search={{ mode: "register" }}>
                    Bu paketle başla
                  </Link>
                </Button>
              </article>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="karsilastirma" className="mt-20">
        <h2 id="karsilastirma" className="text-2xl font-extrabold sm:text-3xl">
          Paket karşılaştırma tablosu
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Limitler mağaza başınadır. “Sınırsız” olarak görünen değerlerde teknik adil kullanım
          politikası geçerlidir.
        </p>
        <div className="mt-6 overflow-x-auto rounded-2xl border">
          <table className="w-full min-w-[720px] text-sm">
            <caption className="sr-only">Mefticaret e-ticaret paketlerinin limit karşılaştırması</caption>
            <thead className="bg-muted/50 text-left">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Özellik
                </th>
                {list.map((plan) => (
                  <th key={plan.id} scope="col" className="px-4 py-3 font-semibold">
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <th scope="row" className="px-4 py-3 text-left font-medium">
                  {interval === "yearly" ? "Yıllık fiyat" : "Aylık fiyat"}
                </th>
                {list.map((plan) => (
                  <td key={plan.id} className="px-4 py-3">
                    {priceOf(plan) === 0 ? "Ücretsiz" : formatMoney(priceOf(plan), plan.currency)}
                  </td>
                ))}
              </tr>
              <tr className="border-t">
                <th scope="row" className="px-4 py-3 text-left font-medium">
                  Komisyon oranı
                </th>
                {list.map((plan) => (
                  <td key={plan.id} className="px-4 py-3">
                    %{(Number(plan.commission_rate) * 100).toFixed(1)}
                  </td>
                ))}
              </tr>
              <tr className="border-t">
                <th scope="row" className="px-4 py-3 text-left font-medium">
                  Ücretsiz deneme
                </th>
                {list.map((plan) => (
                  <td key={plan.id} className="px-4 py-3">
                    {plan.trial_days > 0 ? (
                      `${plan.trial_days} gün`
                    ) : (
                      <Minus className="size-4 text-muted-foreground" aria-label="Yok" />
                    )}
                  </td>
                ))}
              </tr>
              {LIMIT_ROWS.map((row) => (
                <tr key={row.key} className="border-t">
                  <th scope="row" className="px-4 py-3 text-left font-medium">
                    {row.label}
                  </th>
                  {list.map((plan) => {
                    const limits = (plan.limits ?? {}) as Record<string, number>;
                    return (
                      <td key={plan.id} className="px-4 py-3">
                        {planLimitLabel(limits[row.key])}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-t align-top">
                <th scope="row" className="px-4 py-3 text-left font-medium">
                  Öne çıkan özellikler
                </th>
                {list.map((plan) => {
                  const features = Array.isArray(plan.features) ? (plan.features as string[]) : [];
                  return (
                    <td key={plan.id} className="px-4 py-3">
                      <ul className="space-y-1">
                        {features.map((feature) => (
                          <li key={feature}>{feature}</li>
                        ))}
                      </ul>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
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
        <h2 className="text-2xl font-extrabold sm:text-3xl">Paketinizi seçin, bugün satışa başlayın</h2>
        <p className="mx-auto mt-4 max-w-lg text-sm text-muted-foreground">
          Ücretsiz paketle mağazanızı açın, işiniz büyüdükçe tek tıkla yükseltin.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="rounded-full">
            <Link to="/auth" search={{ mode: "register" }}>
              Ücretsiz başla
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="rounded-full">
            <Link to="/e-ticaret-nasil-yapilir">E-ticaret nasıl yapılır?</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="rounded-full">
            <Link to="/e-ticaret-maliyeti">E-ticaret sitesi kurma maliyeti</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
