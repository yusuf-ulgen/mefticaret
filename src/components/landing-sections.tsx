import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Calculator,
  CreditCard,
  GripVertical,
  MessageSquare,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Truck,
} from "lucide-react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { sectionIcon, type SiteSection } from "@/lib/site-content";



/* ---------------------------------- Entegrasyonlar ---------------------------------- */

const INTEGRATION_CATEGORIES = [
  { label: "PAZARYERLERİ", icon: ShoppingBag, count: "12+" },
  { label: "KARGO", icon: Truck, count: "9+" },
  { label: "ÖDEMELER", icon: CreditCard, count: "8+" },
  { label: "DİJİTAL DÜNYA", icon: BarChart3, count: "10+" },
  { label: "SMS PAZARLAMA", icon: MessageSquare, count: "6+" },
  { label: "MUHASEBE", icon: Calculator, count: "5+" },
];

export function IntegrationsSection() {
  return (
    <section id="entegrasyonlar" className="mx-auto max-w-7xl px-4 py-20 lg:px-8 lg:py-28">
      <div className="text-center">
        <span className="eyebrow">Entegrasyonlar</span>
        <h2 className="mx-auto mt-6 max-w-3xl text-3xl font-extrabold sm:text-4xl lg:text-5xl">
          Tüm Entegrasyonlar, Tek Merkez
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-muted-foreground">
          Pazaryerlerinden kargoya, e-faturadan reklam platformlarına kadar tüm araçlarınız tek
          panelde buluşsun. Sekmeler arasında kaybolmadan işinizi yönetin.
        </p>
      </div>

      <div className="mt-14 grid items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          {INTEGRATION_CATEGORIES.slice(0, 3).map((item) => (
            <IntegrationCard key={item.label} {...item} />
          ))}
        </div>

        <div className="mx-auto grid size-44 place-items-center rounded-full border border-border bg-secondary/60 text-center lg:size-52">
          <div>
            <p className="font-display text-4xl font-extrabold tracking-tighter text-brand">50+</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Entegrasyon
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          {INTEGRATION_CATEGORIES.slice(3).map((item) => (
            <IntegrationCard key={item.label} {...item} />
          ))}
        </div>
      </div>
    </section>
  );
}

function IntegrationCard({
  label,
  count,
  icon: Icon,
}: {
  label: string;
  count: string;
  icon: typeof ShoppingBag;
}) {
  return (
    <div className="showcase-card flex items-center gap-3 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold uppercase tracking-widest">{label}</p>
        <p className="text-sm text-muted-foreground">{count} bağlantı</p>
      </div>
      <ArrowUpRight className="ml-auto size-4 shrink-0 text-muted-foreground" />
    </div>
  );
}

/* ------------------------------- Tema blok yönetimi -------------------------------- */

const INITIAL_BLOCKS = [
  { id: "slider-block", name: "Blok Slider" },
  { id: "video-block", name: "Video" },
  { id: "category-products", name: "Kategori Ürünleri" },
  { id: "icon-box", name: "İkon Kutuları" },
];

function ThemeBlocksDemo() {
  const [blocks, setBlocks] = useState(INITIAL_BLOCKS);

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    setBlocks(next);
  };

  return (
    <div className="showcase-card p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Sayfa İçeriği
      </p>
      <ul className="mt-4 space-y-2">
        {blocks.map((block, index) => (
          <li
            key={block.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-secondary/50 px-3 py-2.5"
          >
            <GripVertical className="size-4 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{block.name}</p>
              <p className="truncate text-xs text-muted-foreground">{block.id}</p>
            </div>
            <div className="ml-auto flex gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7 rounded-full"
                aria-label={`${block.name} bloğunu yukarı taşı`}
                onClick={() => move(index, -1)}
              >
                ↑
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7 rounded-full"
                aria-label={`${block.name} bloğunu aşağı taşı`}
                onClick={() => move(index, 1)}
              >
                ↓
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        onClick={() =>
          setBlocks((prev) => [...prev, { id: `custom-block-${prev.length + 1}`, name: "Yeni Blok" }])
        }
      >
        <Plus className="size-4" /> Blok ekle
      </button>
    </div>
  );
}

/* ---------------------------------- Site Kit --------------------------------------- */

const SITE_KIT = [
  { code: "TK", name: "TikTok Pixel", text: "Dönüşüm takibi & hedef kitle" },
  { code: "GA", name: "Google Ads", text: "Reklam dönüşüm & remarketing" },
  { code: "MP", name: "Meta Pixel", text: "Facebook & Instagram reklamları" },
  { code: "G4", name: "Google Analytics 4", text: "Trafik & davranış analizi" },
  { code: "GT", name: "Google Tag Manager", text: "Merkezi etiket yönetimi" },
];

function SiteKitDemo() {
  const [connected, setConnected] = useState<string[]>([]);
  const allOn = connected.length === SITE_KIT.length;

  return (
    <div className="showcase-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Site Kit — Entegrasyonlar</p>
          <p className="text-xs text-muted-foreground">Tek tıkla tüm araçları bağlayın</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant={allOn ? "outline" : "default"}
          className="rounded-full"
          onClick={() => setConnected(allOn ? [] : SITE_KIT.map((item) => item.code))}
        >
          {allOn ? "Tümünü Kaldır" : "Tümünü Bağla"}
        </Button>
      </div>
      <ul className="mt-4 space-y-2">
        {SITE_KIT.map((item) => {
          const on = connected.includes(item.code);
          return (
            <li
              key={item.code}
              className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-xs font-bold">
                {item.code}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="truncate text-xs text-muted-foreground">{item.text}</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <span className={`text-xs ${on ? "text-success" : "text-muted-foreground"}`}>
                  {on ? "Bağlandı" : "Bağlı değil"}
                </span>
                <Switch
                  checked={on}
                  aria-label={`${item.name} bağlantısı`}
                  onCheckedChange={(checked) =>
                    setConnected((prev) =>
                      checked ? [...prev, item.code] : prev.filter((code) => code !== item.code),
                    )
                  }
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------- AI içerik stüdyosu -------------------------------- */

const AI_ENGINES = ["ChatGPT", "Google Gemini", "Claude"];
const AI_MODULES = [
  "Ürün Açıklaması",
  "Blog İçeriği",
  "E-Ticaret Sözleşmesi",
  "Rakip Analizi",
  "İçerik Asistanı",
];

function AiStudioDemo() {
  const [engine, setEngine] = useState(AI_ENGINES[0]!);
  const [module, setModule] = useState(AI_MODULES[0]!);
  const [output, setOutput] = useState<string | null>(null);

  return (
    <div className="showcase-card p-5">
      <p className="text-sm font-semibold">AI İçerik Stüdyosu</p>
      <div className="mt-4 space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            AI Motoru
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {AI_ENGINES.map((item) => (
              <Chip key={item} active={engine === item} onClick={() => setEngine(item)}>
                {item}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Modül
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {AI_MODULES.map((item) => (
              <Chip key={item} active={module === item} onClick={() => setModule(item)}>
                {item}
              </Chip>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-border bg-secondary/50 p-4">
        <p className="text-xs text-muted-foreground">
          Aktif seçim: <span className="font-medium text-foreground">{engine}</span> ›{" "}
          <span className="font-medium text-foreground">{module}</span>
        </p>
        <p className="mt-3 min-h-12 text-sm">
          {output ?? "Motor ve modül seçin, ardından Oluştur'a tıklayın."}
        </p>
      </div>
      <Button
        type="button"
        className="mt-4 w-full rounded-full"
        onClick={() =>
          setOutput(
            `${engine} ile "${module}" taslağı hazır: mağaza verilerinizden beslenen, SEO uyumlu ve yayına hazır bir metin panelinizde oluşturulur.`,
          )
        }
      >
        <Sparkles className="mr-2 size-4" /> Oluştur
      </Button>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-brand bg-brand-soft text-brand"
          : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

/* --------------------------------- SEO araçları ------------------------------------ */

const SEO_SCORES = [
  ["Meta başlıklar", 92],
  ["URL yapısı", 88],
  ["Robots.txt", 100],
  ["Kırık linkler", 74],
] as const;

const BROKEN_LINKS = [
  ["/urunler/kirmizi-elbise-eski", 142],
  ["/blog/2023/seo-rehberi", 89],
  ["/kampanya/yaz-indirimi", 54],
] as const;

function SeoToolsDemo() {
  return (
    <div className="showcase-card p-5">
      <p className="text-sm font-semibold">SEO Araçları</p>
      <Tabs defaultValue="score" className="mt-4">
        <TabsList className="w-full">
          <TabsTrigger value="score" className="flex-1">
            AI Skor
          </TabsTrigger>
          <TabsTrigger value="meta" className="flex-1">
            Meta
          </TabsTrigger>
          <TabsTrigger value="404" className="flex-1">
            404 İzleme
          </TabsTrigger>
        </TabsList>

        <TabsContent value="score" className="mt-4">
          <p className="font-display text-4xl font-extrabold tracking-tighter">
            88<span className="text-base font-medium text-muted-foreground">/100</span>
          </p>
          <ul className="mt-4 space-y-3">
            {SEO_SCORES.map(([label, value]) => (
              <li key={label}>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium text-success">{value}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${value}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="meta" className="mt-4">
          <div className="rounded-xl border border-border p-4">
            <p className="text-sm font-medium text-brand">Sayfa Başlığı | Mağazanız</p>
            <p className="text-xs text-success">siteniz.com › kategori › urun-adi</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Meta açıklamanız arama sonuçlarında bu şekilde görünür.
            </p>
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            AI Önerileri
          </p>
          <ul className="mt-2 space-y-2 text-sm">
            {["Kablosuz Kulaklık — 40 Saat Pil | Marka", "En İyi Kulaklık 2026 — Ücretsiz Kargo"].map(
              (item) => (
                <li
                  key={item}
                  className="flex items-center gap-2 rounded-xl border border-border px-3 py-2"
                >
                  <Search className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{item}</span>
                  <span className="ml-auto shrink-0 text-xs font-medium text-brand">Uygula →</span>
                </li>
              ),
            )}
          </ul>
        </TabsContent>

        <TabsContent value="404" className="mt-4">
          <ul className="space-y-2 text-sm">
            {BROKEN_LINKS.map(([path, hits]) => (
              <li
                key={path}
                className="flex items-center gap-2 rounded-xl border border-border px-3 py-2"
              >
                <span className="rounded-md bg-secondary px-1.5 py-0.5 text-xs font-semibold">
                  404
                </span>
                <span className="truncate">{path}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">{hits} istek</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Kırık linkleri tek tıkla yeni adrese yönlendirin.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function PlatformDemosSection() {
  return (
    <section id="ozellikler" className="border-y border-border bg-secondary/40 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="text-center">
          <span className="eyebrow">Panelde Neler Var?</span>
          <h2 className="mx-auto mt-6 max-w-3xl text-3xl font-extrabold sm:text-4xl lg:text-5xl">
            Deneyin: Panel Böyle Çalışıyor
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-muted-foreground">
            Tema bloklarını sıralayın, pazarlama araçlarını tek tıkla bağlayın, yapay zeka ile içerik
            üretin ve SEO skorunuzu izleyin.
          </p>
        </div>
        <div className="mt-14 grid gap-4 lg:grid-cols-2">
          <ThemeBlocksDemo />
          <SiteKitDemo />
          <AiStudioDemo />
          <SeoToolsDemo />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------- Blog ---------------------------------------- */

const POSTS = [
  {
    tag: "Rehber",
    title: "Sıfırdan e-ticaret mağazası açma rehberi",
    text: "Domain, tema, ürün girişi, ödeme ve kargo kurulumunu adım adım tamamlayın.",
    read: "8 dk okuma",
  },
  {
    tag: "Pazaryeri",
    title: "Pazaryeri entegrasyonlarında stok senkronizasyonu",
    text: "Tek stoktan çok kanala satış yaparken aşırı satışı nasıl engellersiniz?",
    read: "6 dk okuma",
  },
  {
    tag: "SEO",
    title: "Ürün sayfası SEO'su için 10 teknik kontrol",
    text: "Yapılandırılmış veri, hız, meta düzeni ve iç link stratejisi.",
    read: "7 dk okuma",
  },
];

export function BlogSection() {
  return (
    <section id="blog" className="mx-auto max-w-7xl px-4 py-20 lg:px-8 lg:py-28">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <span className="eyebrow">Blog</span>
          <h2 className="mt-6 max-w-2xl text-3xl font-extrabold sm:text-4xl lg:text-5xl">
            E-Ticaret Dünyasından İlham Alın
          </h2>
          <p className="mt-5 max-w-xl text-muted-foreground">
            E-ticaret rehberleri, sektör trendleri ve uzman ipuçlarıyla her zaman bir adım önde olun.
          </p>
        </div>
      </div>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {POSTS.map((post) => (
          <article key={post.title} className="showcase-card flex flex-col p-6">
            <span className="eyebrow">{post.tag}</span>
            <h3 className="mt-4 text-lg font-semibold leading-snug">{post.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{post.text}</p>
            <p className="mt-6 text-xs text-muted-foreground">{post.read}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------- SSS ---------------------------------------- */

const FAQ = [
  {
    q: "Mağazamı kurmak ne kadar sürer?",
    a: "Kayıt olduktan sonra mağazanız otomatik alt alan adıyla anında oluşur. Tema seçimi, ürün girişi ve ödeme kurulumu ile aynı gün satışa başlayabilirsiniz.",
  },
  {
    q: "Kendi domainimi bağlayabilir miyim?",
    a: "Evet. magazam.com veya www.magazam.com gibi özel domainlerinizi bağlayabilir, DNS doğrulamasını panelden takip edebilir ve SSL sertifikanızın otomatik kurulmasını bekleyebilirsiniz.",
  },
  {
    q: "Tek hesapla birden fazla mağaza yönetebilir miyim?",
    a: "Evet. Mefticaret çok kiracılı bir altyapıdır; tek hesapla birden fazla mağaza açabilir, her mağaza için ayrı ekip, tema ve ayar yönetebilirsiniz. Mağaza verileri veritabanı seviyesinde birbirinden izole edilir.",
  },
  {
    q: "Mevcut mağazamdaki verileri taşıyabilir miyim?",
    a: "Ürün, varyant, kategori ve müşteri verilerinizi CSV içe aktarma ile taşıyabilirsiniz. Toplu fiyat, stok, kategori ve etiket düzenleme araçları da hazır.",
  },
  {
    q: "Paket limitleri nasıl belirleniyor?",
    a: "Ürün, sipariş, personel, depolama, domain, API ve AI kullanım limitleri veritabanında tutulur ve yönetici panelinden güncellenir. Paketiniz büyüdükçe limitleriniz anında yükselir.",
  },
  {
    q: "Ödeme ve kargo entegrasyonları var mı?",
    a: "Ödeme, kargo, pazaryeri, muhasebe ve pazarlama araçları için connector altyapısı hazırdır; bağlantılarınızı panelden yönetir, webhook kayıtlarını ve yeniden gönderimleri izlersiniz.",
  },
];

export function FaqSection() {
  return (
    <section id="sss" className="border-t border-border bg-secondary/40 py-20 lg:py-28">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 lg:grid-cols-[minmax(0,380px)_1fr] lg:px-8">
        <div>
          <span className="eyebrow">Sorular &amp; Cevaplar</span>
          <h2 className="mt-6 text-3xl font-extrabold sm:text-4xl">Sıkça Sorulan Sorular</h2>
          <p className="mt-5 text-muted-foreground">
            Mefticaret ile mağaza kurmak ve büyütmek hakkında merak ettiğiniz her şey burada.
          </p>
          <Button asChild variant="outline" className="mt-6 rounded-full">
            <Link to="/auth" search={{ mode: "register" }}>
              Ücretsiz Başlayın <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </div>
        <Accordion type="single" collapsible className="showcase-card px-5 py-2">
          {FAQ.map((item, index) => (
            <AccordionItem key={item.q} value={`faq-${index}`}>
              <AccordionTrigger className="text-left text-base font-semibold">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
