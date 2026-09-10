import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CreditCard,
  Languages,
  MessageSquare,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  Truck,
  Zap,
} from "lucide-react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { getPublicAppShowcase } from "@/lib/app-showcase.functions";
import { publicPlatformPostsQuery } from "@/lib/platform-blog-queries";
import { sectionIcon, type SiteSection } from "@/lib/site-content";



/* ---------------------------------- Entegrasyonlar ---------------------------------- */

export function IntegrationsSection({ section }: { section: SiteSection | null }) {
  if (!section) return null;
  const items = section.items;
  const half = Math.ceil(items.length / 2);

  return (
    <section id="entegrasyonlar" className="mx-auto max-w-7xl px-4 py-20 lg:px-8 lg:py-28">
      <div className="text-center">
        {section.eyebrow ? <span className="eyebrow">{section.eyebrow}</span> : null}
        <h2 className="mx-auto mt-6 max-w-3xl text-3xl font-extrabold sm:text-4xl lg:text-5xl">
          {section.title}
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-muted-foreground">{section.subtitle}</p>
      </div>

      <div className="mt-14 grid grid-cols-1 items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-1">
          {items.slice(0, half).map((item, index) => (
            <IntegrationCard key={`${item["label"]}-${index}`} item={item} />
          ))}
        </div>

        <div className="mx-auto grid size-44 place-items-center rounded-full border border-border bg-secondary/60 text-center lg:size-52">
          <div>
            <p className="font-display text-4xl font-extrabold tracking-tighter text-brand">
              {section.badge}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Entegrasyon
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-1">
          {items.slice(half).map((item, index) => (
            <IntegrationCard key={`${item["label"]}-b-${index}`} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}

function IntegrationCard({ item }: { item: Record<string, string> }) {
  const Icon = sectionIcon(item["icon"]);

  return (
    <div className="showcase-card flex items-center gap-3 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold uppercase tracking-widest">{item["label"]}</p>
        <p className="text-sm text-muted-foreground">{item["count"]} bağlantı</p>

      </div>
      <ArrowUpRight className="ml-auto size-4 shrink-0 text-muted-foreground" />
    </div>
  );
}

/* ------------------------- Platform yetenekleri (öne çıkanlar) ---------------------- */

const CAPABILITY_GROUPS = [
  {
    eyebrow: "UYGULAMA MAĞAZASI",
    title: "Tek tıkla kurulan uygulamalar",
    text: "İhtiyacın olan modülü mağazana ekle, anında kullanmaya başla.",
    icon: ShoppingBag,
    items: [
      { label: "Instagram DM & Yorum Otomasyonu", icon: MessageSquare },
      { label: "TikTok Mesaj & Satış Modülü", icon: MessageSquare },
      { label: "Facebook Marketplace Yayını", icon: Store },
      { label: "Dil & Çeviri Merkezi", icon: Languages },
    ],
  },
  {
    eyebrow: "OTOMASYON & YAPAY ZEKÂ",
    title: "İşleri senin yerine yapan akıllı araçlar",
    text: "Sürükle bırak akışlar kur, içeriği yapay zekâya yazdır.",
    icon: Sparkles,
    items: [
      { label: "Görsel otomasyon kurucu (akış tasarımı)", icon: Zap },
      { label: "AI blog ve ürün açıklaması yazarı", icon: Sparkles },
      { label: "Otomatik SEO iyileştirme motoru", icon: Search },
      { label: "Terk edilen sepet ve SMS bildirimleri", icon: MessageSquare },
    ],
  },
  {
    eyebrow: "PAZARYERİ, KARGO & ÖDEME",
    title: "Satış kanallarının tamamı tek panelde",
    text: "Stok, fiyat ve sipariş her kanalda otomatik senkronize olur.",
    icon: Truck,
    items: [
      { label: "Pazaryeri ürün ve sipariş senkronu", icon: ShoppingBag },
      { label: "İade yönetimi ve otomatik stok güncelleme", icon: BarChart3 },
      { label: "Kargo firmaları ve etiket basımı", icon: Truck },
      { label: "Ödeme sağlayıcıları ve taksit seçenekleri", icon: CreditCard },
    ],
  },
];

export function PlatformCapabilitiesSection() {
  return (
    <section id="ozellikler" className="border-y border-border bg-secondary/40 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="text-center">
          <span className="eyebrow">Platform Özellikleri</span>
          <h2 className="mx-auto mt-6 max-w-3xl text-3xl font-extrabold sm:text-4xl lg:text-5xl">
            Satışını Büyüten Her Şey Hazır Geliyor
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-muted-foreground">
            Uygulama mağazası, yapay zekâ destekli otomasyonlar ve pazaryeri–kargo–ödeme
            entegrasyonları Mefticaret ile birlikte gelir.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {CAPABILITY_GROUPS.map((group) => (
            <article key={group.title} className="showcase-card flex flex-col p-6">
              <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
                <group.icon className="size-5" />
              </span>
              <span className="eyebrow mt-5">{group.eyebrow}</span>
              <h3 className="mt-3 text-lg font-semibold leading-snug">{group.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{group.text}</p>
              <ul className="mt-6 flex flex-1 flex-col gap-3">
                {group.items.map((item) => (
                  <li key={item.label} className="flex items-start gap-3 text-sm">
                    <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                      <item.icon className="size-3.5" />
                    </span>
                    <span className="leading-relaxed">{item.label}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Button asChild className="rounded-full">
            <Link to="/auth" search={{ mode: "register" }}>
              Ücretsiz Başlayın <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------- Blog ---------------------------------------- */

export function BlogSection({ section }: { section: SiteSection | null }) {
  const { data: posts } = useQuery(publicPlatformPostsQuery());
  const [category, setCategory] = useState<string>("all");

  const categories = useMemo(
    () =>
      [...new Set((posts ?? []).map((post) => (post.category ?? "").trim()).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, "tr"),
      ),
    [posts],
  );

  const visible = useMemo(
    () =>
      (posts ?? [])
        .filter((post) => category === "all" || (post.category ?? "") === category)
        .slice(0, 6),
    [posts, category],
  );

  if (!section) return null;

  return (
    <section id="blog" className="mx-auto max-w-7xl px-4 py-20 lg:px-8 lg:py-28">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          {section.eyebrow ? <span className="eyebrow">{section.eyebrow}</span> : null}
          <h2 className="mt-6 max-w-2xl text-3xl font-extrabold sm:text-4xl lg:text-5xl">
            {section.title}
          </h2>
          <p className="mt-5 max-w-xl text-muted-foreground">{section.subtitle}</p>
        </div>
        <Button asChild variant="outline" className="rounded-full">
          <Link to="/blog">
            Tüm yazılar
            <ArrowUpRight className="ml-1 size-4" />
          </Link>
        </Button>
      </div>

      {categories.length > 0 ? (
        <div className="mt-8 flex flex-wrap gap-2">
          {["all", ...categories].map((item) => (
            <Button
              key={item}
              type="button"
              size="sm"
              variant={category === item ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setCategory(item)}
            >
              {item === "all" ? "Tümü" : item}
            </Button>
          ))}
        </div>
      ) : null}

      {visible.length > 0 ? (
        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          {visible.map((post) => (
            <Link
              key={post.slug}
              to="/blog/$slug"
              params={{ slug: post.slug }}
              className="showcase-card group flex flex-col p-6"
            >
              {post.category ? <span className="eyebrow">{post.category}</span> : null}
              <h3 className="mt-4 text-lg font-semibold leading-snug group-hover:underline">
                {post.title}
              </h3>
              {post.excerpt ? (
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                  {post.excerpt}
                </p>
              ) : null}
              <p className="mt-6 text-xs text-muted-foreground">
                {post.author_name ?? "Mefticaret"}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          {section.items.map((post, index) => (
            <article key={`${post["title"]}-${index}`} className="showcase-card flex flex-col p-6">
              {post["tag"] ? <span className="eyebrow">{post["tag"]}</span> : null}
              <h3 className="mt-4 text-lg font-semibold leading-snug">{post["title"]}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{post["text"]}</p>
              <p className="mt-6 text-xs text-muted-foreground">{post["read"]}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

/* --------------------------- Uygulama vitrini (animasyonlu) ------------------------- */

type ShowcaseApp = {
  code: string;
  name: string;
  category: string;
  logoUrl: string | null;
  logoEmoji: string | null;
};

function AppLogoChip({ app }: { app: ShowcaseApp }) {
  return (
    <div className="showcase-card flex shrink-0 items-center gap-3 px-4 py-3">
      {app.logoUrl ? (
        <img
          src={app.logoUrl}
          alt={`${app.name} logosu`}
          loading="lazy"
          className="size-8 shrink-0 rounded-lg object-contain"
        />
      ) : (
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-base">
          {app.logoEmoji ?? "🧩"}
        </span>
      )}
      <span className="whitespace-nowrap text-sm font-semibold">{app.name}</span>
    </div>
  );
}

export function AppShowcaseSection() {
  const { data: apps } = useQuery({
    queryKey: ["public-app-showcase"],
    queryFn: () => getPublicAppShowcase(),
    staleTime: 300_000,
  });

  if (!apps?.length) return null;
  const half = Math.ceil(apps.length / 2);
  const rows = [apps.slice(0, half), apps.slice(half)];

  return (
    <section id="uygulamalar" className="overflow-hidden py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 text-center lg:px-8">
        <span className="eyebrow">Uygulama Mağazası</span>
        <h2 className="mx-auto mt-6 max-w-3xl text-3xl font-extrabold sm:text-4xl lg:text-5xl">
          {apps.length}+ Uygulama ve Entegrasyon Tek Panelde
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-muted-foreground">
          Pazaryerlerinden kargoya, pazarlamadan otomasyona — mağazanı büyüten tüm araçlar tek tıkla
          kurulur.
        </p>
      </div>

      <div className="fade-mask-x mt-14 space-y-4" aria-hidden="true">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="flex overflow-hidden">
            <div
              className={`flex w-max gap-4 pr-4 hover:[animation-play-state:paused] ${
                rowIndex % 2 === 0 ? "marquee-row" : "marquee-row-reverse"
              }`}
            >
              {[...row, ...row].map((app, index) => (
                <AppLogoChip key={`${app.code}-${index}`} app={app} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 text-center">
        <Button asChild variant="outline" className="rounded-full">
          <Link to="/auth" search={{ mode: "register" }}>
            Uygulama Mağazasını Keşfet <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
}

/* -------------------------------------- SSS ---------------------------------------- */

export function FaqSection({ section }: { section: SiteSection | null }) {
  if (!section) return null;
  return (
    <section id="sss" className="border-t border-border bg-secondary/40 py-20 lg:py-28">
      <div className="mx-auto grid grid-cols-1 max-w-7xl gap-10 px-4 lg:grid-cols-[minmax(0,380px)_1fr] lg:px-8">
        <div>
          {section.eyebrow ? <span className="eyebrow">{section.eyebrow}</span> : null}
          <h2 className="mt-6 text-3xl font-extrabold sm:text-4xl">{section.title}</h2>
          <p className="mt-5 text-muted-foreground">{section.subtitle}</p>
          {section.primary_label ? (
            <Button asChild variant="outline" className="mt-6 rounded-full">
              <Link to="/auth" search={{ mode: "register" }}>
                {section.primary_label} <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          ) : null}
        </div>
        <Accordion type="single" collapsible className="showcase-card px-5 py-2">
          {section.items.map((item, index) => (
            <AccordionItem key={`faq-${index}`} value={`faq-${index}`}>
              <AccordionTrigger className="text-left text-base font-semibold">
                {item["q"]}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {item["a"]}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
