import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Check,
  Globe,
  Headphones,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
  Users,
  Zap,
} from "lucide-react";

import {
  BlogSection,
  FaqSection,
  IntegrationsSection,
  PlatformDemosSection,
} from "@/components/landing-sections";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { formatMoney, planLimitLabel } from "@/lib/mefti";
import { plansQuery } from "@/lib/store-queries";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mefticaret — Mağazanı Kur, Hemen Satışa Başla" },
      {
        name: "description",
        content:
          "Mefticaret ile dakikalar içinde mağazanı kur; ürün, stok, sipariş, kargo, ödeme ve pazaryeri yönetimi tek panelde. Çok kiracılı, ölçeklenebilir e-ticaret altyapısı.",
      },
      { property: "og:title", content: "Mefticaret — Mağazanı Kur, Hemen Satışa Başla" },
      {
        property: "og:description",
        content:
          "E-ticaret altyapın hazır: mağaza kur, temanı tasarla, domain bağla, siparişlerini yönet ve büyü.",
      },
    ],
  }),
  component: LandingPage,
});

const SHOWCASE_LEFT = [
  { title: "Profesyonel Aynasız Kamera", price: "64.999 TL" },
  { title: "Minimal Takı Seti", price: "6.799 TL" },
  { title: "Espresso Kahve Makinesi", price: "24.999 TL" },
];

const SHOWCASE_RIGHT = [
  { title: "Modern Masa Lambası", price: "3.499 TL" },
  { title: "Deri Cüzdan", price: "2.999 TL" },
  { title: "Lilyum Buketi", price: "1.899 TL" },
];

const TRUST = [
  { icon: Zap, label: "Hızlı Kurulum" },
  { icon: Headphones, label: "7/24 Destek" },
  { icon: ShieldCheck, label: "Güvenli Altyapı" },
];

const MODULES = [
  { icon: Store, title: "Çoklu mağaza", text: "Tek hesap, sınırsız mağaza. Saniyeler içinde geçiş yap." },
  { icon: ShieldCheck, title: "Tenant izolasyonu", text: "Veri erişimi veritabanı seviyesinde politika ile ayrılır." },
  { icon: Users, title: "Rol bazlı ekip", text: "Sahip, yönetici, personel, pazarlama, destek rolleri." },
  { icon: Globe, title: "Domain yönetimi", text: "Alt alan adı + özel domain, DNS doğrulama ve SSL durumu." },
  { icon: LayoutDashboard, title: "Tema blok yönetimi", text: "Sürükle-bırak bölümler, canlı önizleme, sürüm geçmişi." },
  { icon: Boxes, title: "Modüler mimari", text: "Ürün, sipariş, ödeme, pazaryeri bağımsız modüller." },
  { icon: Truck, title: "Connector sistemi", text: "Ödeme, kargo, ERP ve pazaryeri bağlantıları eklenebilir." },
  { icon: Sparkles, title: "Yapay zeka hazır", text: "Ürün metni, SEO ve içerik üretimi mağaza bazlı takip ile." },
];

const REFERENCES = [
  {
    brand: "Enfez Yöresel",
    quote:
      "Daha önce farklı altyapılar kullandık ancak Mefticaret'e geçtikten sonra hem site hızı hem de yönetim paneli bizi ciddi anlamda rahatlattı.",
    person: "Mahmut Taşkın",
    stats: [
      ["+148%", "Yıllık ciro"],
      ["596", "Sipariş sayısı"],
      ["+140%", "Organik trafik"],
    ],
  },
  {
    brand: "Kartvizit Marketim",
    quote:
      "SEO tarafındaki teknik altyapı beklentimizin çok üzerinde çıktı. Organik görünürlüğümüzde kısa sürede gözle görülür artış elde ettik.",
    person: "Bahadır Dermanlı",
    stats: [
      ["+96%", "Yıllık ciro"],
      ["8.750", "Sipariş sayısı"],
      ["+210%", "Organik trafik"],
    ],
  },
  {
    brand: "Teknik Depo",
    quote:
      "Mevcut sistemimizden geçiş süreci düşündüğümüzden çok daha kolay ilerledi. Ürünler, kategoriler ve müşteri verileri eksiksiz taşındı.",
    person: "Ümit Özalp",
    stats: [
      ["+79%", "Yıllık ciro"],
      ["980", "Sipariş sayısı"],
      ["+168%", "Organik trafik"],
    ],
  },
];

function ShowcaseCard({ title, price }: { title: string; price: string }) {
  return (
    <article className="showcase-card">
      <div
        className="h-40 w-full"
        style={{
          background:
            "linear-gradient(150deg, color-mix(in oklab, var(--color-brand) 14%, var(--color-card)), var(--color-muted))",
        }}
      />
      <div className="p-4">
        <h3 className="text-sm font-semibold leading-snug">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{price}</p>
      </div>
    </article>
  );
}

function ShowcaseColumn({
  items,
  slow,
  className,
}: {
  items: { title: string; price: string }[];
  slow?: boolean;
  className?: string;
}) {
  const loop = [...items, ...items, ...items];
  return (
    <div className={`fade-mask-y h-[560px] overflow-hidden ${className ?? ""}`} aria-hidden="true">
      <div className={`space-y-4 ${slow ? "marquee-col-slow" : "marquee-col"}`}>
        {loop.map((item, index) => (
          <ShowcaseCard key={`${item.title}-${index}`} {...item} />
        ))}
      </div>
    </div>
  );
}

function LandingPage() {
  const { session, loading } = useAuth();
  const { data: plans } = useQuery(plansQuery());

  return (
    <div className="min-h-screen bg-background">
      <a href="#icerik" className="skip-link">
        İçeriğe geç
      </a>

      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-18 max-w-7xl items-center px-4 py-3 lg:px-8">
          <Link to="/" className="font-display text-2xl font-extrabold tracking-tighter">
            mefticaret
          </Link>
          <nav
            aria-label="Ana gezinme"
            className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 text-sm font-medium text-muted-foreground md:flex"
          >
            <a href="#moduller" className="transition-colors hover:text-foreground">
              E-Ticaret
            </a>
            <a href="#entegrasyonlar" className="transition-colors hover:text-foreground">
              Entegrasyonlar
            </a>
            <a href="#paketler" className="transition-colors hover:text-foreground">
              Fiyatlandırma
            </a>
            <a href="#blog" className="transition-colors hover:text-foreground">
              Blog
            </a>
            <a href="#sss" className="transition-colors hover:text-foreground">
              SSS
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {loading ? null : session ? (
              <Button asChild className="rounded-full px-5">
                <Link to="/stores">Panele git</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" className="rounded-full">
                  <Link to="/auth">Giriş Yap</Link>
                </Button>
                <Button asChild className="rounded-full px-5">
                  <Link to="/auth" search={{ mode: "register" }}>
                    Kayıt Ol
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="icerik" tabIndex={-1}>
        <section className="relative overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
          <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-16 lg:grid-cols-[minmax(180px,220px)_1fr_minmax(180px,220px)] lg:px-8 lg:py-24">
            <ShowcaseColumn items={SHOWCASE_LEFT} className="hidden lg:block" />

            <div className="mx-auto max-w-2xl text-center">
              <span className="eyebrow">E-Ticaret Altyapınız Hazır</span>
              <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] sm:text-5xl lg:text-6xl">
                Mağazanızı Kurun,
                <br />
                Hemen Satışa Başlayın.
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
                Ürünlerinizi listeleyin, siparişlerinizi yönetin, müşterilerinize kesintisiz alışveriş
                sunun. Stoktan kargoya, ödemeden pazaryerine kadar dijital ticaretinizi büyütecek her şey
                tek çatı altında.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Button asChild variant="outline" size="lg" className="rounded-full">
                  <a href="#referanslar">
                    <Headphones className="mr-2 size-4" /> Bizi Arayın
                  </a>
                </Button>
                <Button asChild size="lg" className="rounded-full">
                  <Link to="/auth" search={{ mode: "register" }}>
                    Ücretsiz Başlayın <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
              </div>
              <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-sm text-muted-foreground">
                {TRUST.map((item) => (
                  <li key={item.label} className="flex items-center gap-2">
                    <item.icon className="size-4 text-brand" />
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>

            <ShowcaseColumn items={SHOWCASE_RIGHT} slow className="hidden lg:block" />
          </div>
        </section>

        <section id="referanslar" className="mx-auto max-w-7xl px-4 py-20 lg:px-8 lg:py-28">
          <div className="text-center">
            <span className="eyebrow">Referanslar</span>
            <h2 className="mx-auto mt-6 max-w-3xl text-3xl font-extrabold sm:text-4xl lg:text-5xl">
              Sıradaki başarı hikayesi sizinki olabilir
            </h2>
            <div className="mt-7">
              <Button asChild variant="outline" className="rounded-full">
                <Link to="/auth" search={{ mode: "register" }}>
                  Referansları gör <ArrowUpRight className="ml-2 size-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {REFERENCES.map((ref) => (
              <article key={ref.brand} className="showcase-card flex flex-col">
                <div
                  className="h-48 w-full"
                  style={{
                    background:
                      "linear-gradient(140deg, color-mix(in oklab, var(--color-brand) 18%, var(--color-card)), var(--color-muted))",
                  }}
                />
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-base font-semibold">{ref.brand}</h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">“{ref.quote}”</p>
                  <p className="mt-4 text-sm font-semibold">
                    {ref.person} <span className="font-normal text-muted-foreground">— Kurucu</span>
                  </p>
                  <dl className="mt-5 grid grid-cols-3 gap-2">
                    {ref.stats.map(([value, label]) => (
                      <div key={label} className="rounded-xl bg-muted px-3 py-2 text-center">
                        <dt className="sr-only">{label}</dt>
                        <dd className="text-sm font-bold text-success">{value}</dd>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </dl>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="moduller" className="border-y border-border bg-secondary/40 py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-4 lg:px-8">
            <div className="text-center">
              <span className="eyebrow">Güçlü Araçlar, Kolay Yönetim</span>
              <h2 className="mx-auto mt-6 max-w-3xl text-3xl font-extrabold sm:text-4xl lg:text-5xl">
                İşinizi Büyütecek Her Şey Tek Platformda
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
                Tasarımdan analitiğe, yapay zekadan SEO'ya. E-ticaret operasyonunuzun her adımını
                kolaylaştıran araçlar sizin için hazır.
              </p>
            </div>
            <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {MODULES.map((module) => (
                <article key={module.title} className="showcase-card p-6">
                  <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
                    <module.icon className="size-5" />
                  </span>
                  <h3 className="mt-5 text-base font-semibold">{module.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{module.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="paketler" className="mx-auto max-w-7xl px-4 py-20 lg:px-8 lg:py-28">
          <div className="text-center">
            <span className="eyebrow">Fiyatlandırma</span>
            <h2 className="mt-6 text-3xl font-extrabold sm:text-4xl lg:text-5xl">
              Büyüdükçe ölçeklenen paketler
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
              Limitler kodda sabit değil; yönetici panelinden anlık güncellenir.
            </p>
          </div>
          <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {(plans ?? []).map((plan) => {
              const limits = (plan.limits ?? {}) as Record<string, number>;
              const featured = plan.code === "professional";
              return (
                <article
                  key={plan.id}
                  data-featured={featured}
                  className="showcase-card flex flex-col p-6 data-[featured=true]:border-brand data-[featured=true]:ring-1 data-[featured=true]:ring-brand/30"
                >
                  <h3 className="text-base font-semibold">{plan.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>
                  <p className="mt-5 font-display text-2xl font-extrabold">
                    {Number(plan.price_monthly) === 0
                      ? "Ücretsiz"
                      : formatMoney(Number(plan.price_monthly), plan.currency)}
                    {Number(plan.price_monthly) > 0 ? (
                      <span className="text-sm font-medium text-muted-foreground">/ay</span>
                    ) : null}
                  </p>
                  <ul className="mt-5 space-y-2 text-sm">
                    {[
                      [planLimitLabel(limits["products"]), "ürün"],
                      [planLimitLabel(limits["orders"]), "sipariş"],
                      [planLimitLabel(limits["staff"]), "personel"],
                      [planLimitLabel(limits["domains"]), "özel domain"],
                    ].map(([value, label]) => (
                      <li key={label} className="flex gap-2">
                        <Check className="mt-0.5 size-4 text-success" />
                        <span>
                          {value} {label}
                        </span>
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
                      Başla
                    </Link>
                  </Button>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-24 lg:px-8">
          <div className="showcase-card px-6 py-14 text-center" style={{ background: "var(--gradient-hero)" }}>
            <h2 className="mx-auto max-w-2xl text-3xl font-extrabold sm:text-4xl">
              Bugün kurun, bugün satmaya başlayın.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
              Kredi kartı gerekmez. Mağazanızı dakikalar içinde yayına alın.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="rounded-full">
                <Link to="/auth" search={{ mode: "register" }}>
                  Ücretsiz Başlayın <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full">
                <a href="#paketler">Paketleri gör</a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 text-sm text-muted-foreground lg:px-8">
          <span className="font-display text-base font-extrabold tracking-tighter text-foreground">
            mefticaret
          </span>
          <span>— E-ticaret işletim sistemi</span>
          <span className="ml-auto">KVKK &amp; GDPR uyumlu mimari</span>
        </div>
      </footer>
    </div>
  );
}
