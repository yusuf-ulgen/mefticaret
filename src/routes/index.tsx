import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Boxes,
  Building2,
  Check,
  Globe,
  LayoutDashboard,
  Rocket,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { formatMoney, planLimitLabel } from "@/lib/mefti";
import { plansQuery } from "@/lib/store-queries";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mefticaret — Kendi E-Ticaret İşletim Sistemin" },
      {
        name: "description",
        content:
          "Mefticaret ile dakikalar içinde mağazanı kur; çoklu mağaza, çoklu domain, rol bazlı ekip yönetimi ve ölçeklenebilir SaaS altyapısı tek panelde.",
      },
      { property: "og:title", content: "Mefticaret — Kendi E-Ticaret İşletim Sistemin" },
      {
        property: "og:description",
        content:
          "Çok kiracılı SaaS e-ticaret altyapısı: mağaza kur, domain bağla, ekibini yönet, ölçekle.",
      },
    ],
  }),
  component: LandingPage,
});

const MODULES = [
  { icon: Store, title: "Çoklu mağaza", text: "Tek hesap, sınırsız mağaza. Saniyeler içinde geçiş yap." },
  { icon: ShieldCheck, title: "Tenant izolasyonu", text: "Veri erişimi veritabanı seviyesinde politika ile ayrılır." },
  { icon: Users, title: "RBAC", text: "Sahip, yönetici, personel, pazarlama, destek rolleri." },
  { icon: Globe, title: "Domain yönetimi", text: "Alt alan adı + özel domain, DNS doğrulama ve SSL durumu." },
  { icon: LayoutDashboard, title: "Gerçek panel", text: "Ciro, sipariş, ziyaretçi ve dönüşüm metrikleri." },
  { icon: Boxes, title: "Modüler mimari", text: "Products, Orders, Payments, Marketplace ayrı modüller." },
  { icon: Truck, title: "Connector sistemi", text: "Ödeme, kargo, ERP ve pazaryeri bağlantıları eklenebilir." },
  { icon: Sparkles, title: "AI hazır", text: "Sağlayıcıdan bağımsız AI katmanı, mağaza bazlı kullanım takibi." },
];

const ROADMAP = [
  { phase: "FAZ 1", title: "Çekirdek", status: "Yayında", items: "Kimlik doğrulama, multi-tenancy, RBAC, mağaza kurulumu, panel, ayarlar, domain, denetim kayıtları" },
  { phase: "FAZ 2", title: "E-Ticaret", status: "Sırada", items: "Ürünler, varyantlar, kategoriler, stok, sipariş, müşteri, sepet" },
  { phase: "FAZ 3", title: "Storefront", status: "Planlandı", items: "Tema motoru, görsel editör, ürün sayfaları, checkout" },
  { phase: "FAZ 4-10", title: "Ödeme → Ölçekleme", status: "Planlandı", items: "Ödeme/kargo connector, abonelik, marketplace, app store, SEO/CMS, AI, altyapı" },
];

function LandingPage() {
  const { session, loading } = useAuth();
  const { data: plans } = useQuery(plansQuery());

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 lg:px-8">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl brand-gradient text-brand-foreground">
              <Rocket className="size-4" />
            </span>
            <span className="font-display text-lg font-semibold">Mefticaret</span>
          </Link>
          <nav className="ml-6 hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#moduller" className="hover:text-foreground">Modüller</a>
            <a href="#paketler" className="hover:text-foreground">Paketler</a>
            <a href="#yol-haritasi" className="hover:text-foreground">Yol haritası</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {loading ? null : session ? (
              <Button asChild size="sm">
                <Link to="/stores">Panele git</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/auth">Giriş yap</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/auth" search={{ mode: "register" }}>
                    Ücretsiz başla
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="hero-surface relative overflow-hidden">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-28">
          <div>
            <Badge variant="secondary" className="mb-5">FAZ 1 çekirdek yayında</Badge>
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
              Mağazanı kur, <span className="text-brand-gradient">imparatorluğunu</span> ölçekle
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed opacity-80">
              Mefticaret bir mağaza oluşturucudan fazlası: çok kiracılı, modüler ve güvenli bir
              e-ticaret işletim sistemi. 100 mağazadan 100.000 mağazaya aynı mimariyle çık.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth" search={{ mode: "register" }}>
                  Mağazamı oluştur <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#paketler">Paketleri gör</a>
              </Button>
            </div>
            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 text-sm">
              {[
                ["Mağaza limiti", "Sınırsız"],
                ["Tenant izolasyonu", "DB seviyesi"],
                ["Rol modeli", "7 rol"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="opacity-60">{label}</dt>
                  <dd className="mt-1 font-display text-lg font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="surface-card grid-lines relative overflow-hidden p-6 text-foreground">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Mağaza panelinden
            </p>
            <p className="mt-2 font-display text-3xl font-semibold">₺1.482.930</p>
            <p className="text-sm text-muted-foreground">Son 90 gün ciro (demo mağaza)</p>
            <div className="mt-6 space-y-3">
              {[
                ["Siparişler", "2.741"],
                ["Ziyaretçi", "118.430"],
                ["Dönüşüm oranı", "%2,31"],
                ["Ortalama sepet", "₺541"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="font-semibold">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="moduller" className="mx-auto max-w-7xl px-4 py-20 lg:px-8">
        <h2 className="font-display text-3xl font-semibold">Modüler çekirdek</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Her yetenek bağımsız bir modül. Bugün ihtiyacın olanı kullan, yarın gerekeni tak.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((module) => (
            <article key={module.title} className="surface-card p-5">
              <span className="grid size-10 place-items-center rounded-lg bg-brand-soft text-brand-foreground">
                <module.icon className="size-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold">{module.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{module.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="paketler" className="border-y border-border bg-secondary/40 py-20">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <h2 className="font-display text-3xl font-semibold">Paketler</h2>
          <p className="mt-2 text-muted-foreground">
            Limitler kodda sabit değil; yönetici panelinden değiştirilebilir.
          </p>
          <div className="mt-10 grid gap-4 lg:grid-cols-5">
            {(plans ?? []).map((plan) => {
              const limits = (plan.limits ?? {}) as Record<string, number>;
              return (
                <article
                  key={plan.id}
                  className="surface-card flex flex-col p-5 data-[featured=true]:border-brand"
                  data-featured={plan.code === "professional"}
                >
                  <h3 className="font-display text-lg font-semibold">{plan.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>
                  <p className="mt-4 font-display text-2xl font-semibold">
                    {Number(plan.price_monthly) === 0 ? "Teklif / Ücretsiz" : formatMoney(Number(plan.price_monthly), plan.currency)}
                    {Number(plan.price_monthly) > 0 ? (
                      <span className="text-sm font-normal text-muted-foreground">/ay</span>
                    ) : null}
                  </p>
                  <ul className="mt-4 space-y-2 text-sm">
                    <li className="flex gap-2">
                      <Check className="mt-0.5 size-4 text-success" />
                      {planLimitLabel(limits["products"])} ürün
                    </li>
                    <li className="flex gap-2">
                      <Check className="mt-0.5 size-4 text-success" />
                      {planLimitLabel(limits["orders"])} sipariş
                    </li>
                    <li className="flex gap-2">
                      <Check className="mt-0.5 size-4 text-success" />
                      {planLimitLabel(limits["staff"])} personel
                    </li>
                    <li className="flex gap-2">
                      <Check className="mt-0.5 size-4 text-success" />
                      {planLimitLabel(limits["domains"])} özel domain
                    </li>
                  </ul>
                  {plan.trial_days > 0 ? (
                    <p className="mt-3 text-xs text-muted-foreground">{plan.trial_days} gün deneme</p>
                  ) : null}
                  <Button asChild className="mt-5 w-full" variant={plan.code === "professional" ? "default" : "outline"}>
                    <Link to="/auth" search={{ mode: "register" }}>Başla</Link>
                  </Button>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="yol-haritasi" className="mx-auto max-w-7xl px-4 py-20 lg:px-8">
        <h2 className="font-display text-3xl font-semibold">Yol haritası</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {ROADMAP.map((item) => (
            <article key={item.phase} className="surface-card p-5">
              <div className="flex items-center gap-2">
                <Badge variant={item.status === "Yayında" ? "default" : "secondary"}>{item.phase}</Badge>
                <span className="text-sm text-muted-foreground">{item.status}</span>
              </div>
              <h3 className="mt-3 font-display text-lg font-semibold">{item.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{item.items}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 text-sm text-muted-foreground lg:px-8">
          <Building2 className="size-4" />
          <span>Mefticaret — E-ticaret işletim sistemi</span>
          <span className="ml-auto">KVKK & GDPR uyumlu mimari</span>
        </div>
      </footer>
    </div>
  );
}
