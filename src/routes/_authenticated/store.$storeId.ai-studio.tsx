import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AlertTriangle, Gauge, Gavel, LineChart, Sparkles, Tags, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { AutoRepricingPanel } from "@/components/pricing/auto-repricing-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  analyzeCompetitorProduct,
  applyBlogPack,
  applyCategoryPack,
  applyLegalDocument,
  applyProductCopyDraft,
  fetchCompetitors,
  fetchStudioCatalog,
  generateBlogPack,
  generateCategoryPack,
  generateLegalDocument,
  generateProductCopy,
  removeCompetitor,
  upsertCompetitor,
} from "@/lib/ai-studio.functions";

export const Route = createFileRoute("/_authenticated/store/$storeId/ai-studio")({
  component: AiStudioPage,
  head: () => ({
    meta: [
      { title: "AI İçerik Stüdyosu — Mefticaret" },
      {
        name: "description",
        content:
          "Rakip analizi, ürün açıklaması paketleri, kategori SEO içeriği, blog paketi ve hukuki metin taslaklarını tek panelden üretin.",
      },
      { property: "og:title", content: "AI İçerik Stüdyosu — Mefticaret" },
      {
        property: "og:description",
        content: "Mağaza verinizle çalışan yapay zeka içerik ve rekabet analizi merkezi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const TONES = ["profesyonel", "samimi", "premium", "teknik", "minimalist"] as const;
const COPY_LABELS: Record<string, string> = {
  seo: "SEO açıklaması",
  short: "Kısa açıklama",
  long: "Uzun açıklama",
  technical: "Teknik açıklama",
  sales: "Satış odaklı açıklama",
  social: "Sosyal medya açıklaması",
};
const LEGAL_OPTIONS = [
  { value: "kvkk", label: "KVKK Aydınlatma Metni" },
  { value: "privacy", label: "Gizlilik Politikası" },
  { value: "returns", label: "İade ve Cayma Politikası" },
  { value: "distance_sales", label: "Mesafeli Satış Sözleşmesi" },
  { value: "terms", label: "Kullanım Koşulları" },
] as const;

function money(value: number | null, currency: string) {
  if (value == null) return "—";
  return `${value.toLocaleString("tr-TR")} ${currency}`;
}

function AiStudioPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();

  const catalogFn = useServerFn(fetchStudioCatalog);
  const competitorsFn = useServerFn(fetchCompetitors);

  const catalog = useQuery({
    queryKey: ["ai-studio-catalog", storeId],
    queryFn: () => catalogFn({ data: { storeId } }),
  });
  const competitors = useQuery({
    queryKey: ["ai-studio-competitors", storeId],
    queryFn: () => competitorsFn({ data: { storeId } }),
  });

  const products = catalog.data?.products ?? [];
  const categories = catalog.data?.categories ?? [];
  const alerts = (competitors.data ?? []).filter((row) => row.cheaperThanUs);

  return (
    <AppShell
      storeId={storeId}
      title="AI İçerik Stüdyosu"
      description="Rakip analizi, ürün açıklamaları, kategori içeriği, blog ve hukuki metin taslakları — hepsi mağazanızın gerçek verisiyle."
    >
      {alerts.length > 0 ? (
        <div className="surface-card mb-4 flex items-start gap-3 border-l-4 border-l-destructive p-4">
          <AlertTriangle className="mt-0.5 size-5 text-destructive" />
          <div>
            <p className="font-medium">{alerts.length} üründe rakip fiyatı sizden düşük</p>
            <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
              {alerts.slice(0, 5).map((row) => (
                <li key={row.id}>
                  {row.productTitle ?? row.name}: rakip {money(row.competitorPrice, row.currency)} · sizde{" "}
                  {money(row.ourPrice, row.currency)} (%{row.diffPct?.toFixed(1)} daha düşük)
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <Tabs defaultValue="competitor" className="space-y-4">
        <TabsList className="flex w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="competitor">
            <LineChart className="mr-2 size-4" /> Rakip analizi
          </TabsTrigger>
          <TabsTrigger value="repricing">
            <Gauge className="mr-2 size-4" /> Otomatik fiyat
          </TabsTrigger>
          <TabsTrigger value="product">
            <Sparkles className="mr-2 size-4" /> Ürün açıklaması
          </TabsTrigger>
          <TabsTrigger value="category">
            <Tags className="mr-2 size-4" /> Kategori içeriği
          </TabsTrigger>
          <TabsTrigger value="blog">
            <Wand2 className="mr-2 size-4" /> Blog
          </TabsTrigger>
          <TabsTrigger value="legal">
            <Gavel className="mr-2 size-4" /> Hukuki metinler
          </TabsTrigger>
        </TabsList>

        <TabsContent value="competitor">
          <CompetitorTab
            storeId={storeId}
            products={products}
            loading={competitors.isLoading}
            rows={competitors.data ?? []}
            onChanged={() => queryClient.invalidateQueries({ queryKey: ["ai-studio-competitors", storeId] })}
          />
        </TabsContent>

        <TabsContent value="repricing">
          <AutoRepricingPanel
            storeId={storeId}
            products={products.map((product) => ({ id: product.id, title: product.title }))}
          />
        </TabsContent>

        <TabsContent value="product">
          <ProductCopyTab storeId={storeId} products={products} />
        </TabsContent>

        <TabsContent value="category">
          <CategoryTab storeId={storeId} categories={categories} />
        </TabsContent>

        <TabsContent value="blog">
          <BlogTab storeId={storeId} />
        </TabsContent>

        <TabsContent value="legal">
          <LegalTab storeId={storeId} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

/* ------------------------------------------------------------- rakip analizi */

type ProductOption = { id: string; title: string; price: number; currency: string; status: string };

function CompetitorTab(props: {
  storeId: string;
  products: ProductOption[];
  rows: Awaited<ReturnType<typeof fetchCompetitors>>;
  loading: boolean;
  onChanged: () => void;
}) {
  const upsertFn = useServerFn(upsertCompetitor);
  const removeFn = useServerFn(removeCompetitor);
  const analyzeFn = useServerFn(analyzeCompetitorProduct);

  const [form, setForm] = useState({
    name: "",
    url: "",
    source: "web",
    productId: "",
    price: "",
    title: "",
    description: "",
    category: "",
    visibility: "",
    serp: "",
    threshold: "0",
  });

  const save = useMutation({
    mutationFn: async () =>
      upsertFn({
        data: {
          storeId: props.storeId,
          name: form.name.trim(),
          url: form.url.trim() ? form.url.trim() : null,
          source: form.source,
          productId: form.productId ? form.productId : null,
          competitorTitle: form.title.trim() ? form.title.trim() : null,
          competitorDescription: form.description.trim() ? form.description.trim() : null,
          competitorCategory: form.category.trim() ? form.category.trim() : null,
          competitorPrice: form.price ? Number(form.price) : null,
          visibilityScore: form.visibility ? Number(form.visibility) : null,
          serpPosition: form.serp ? Number(form.serp) : null,
          alertThresholdPct: Number(form.threshold) || 0,
        },
      }),
    onSuccess: (result) => {
      toast.success(result.alert ? "Kaydedildi — rakip fiyatı sizden düşük, bildirim oluşturuldu" : "Rakip kaydedildi");
      setForm((prev) => ({ ...prev, name: "", url: "", price: "", title: "", description: "", category: "" }));
      props.onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const analyze = useMutation({
    mutationFn: async (competitorId: string) => analyzeFn({ data: { storeId: props.storeId, competitorId } }),
    onSuccess: () => {
      toast.success("Analiz tamamlandı");
      props.onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => removeFn({ data: { storeId: props.storeId, id } }),
    onSuccess: () => {
      toast.success("Rakip kaydı silindi");
      props.onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
      <section className="surface-card space-y-3 p-4">
        <h2 className="font-display text-lg font-semibold">Rakip ürün ekle</h2>
        <p className="text-sm text-muted-foreground">
          Fiyat, başlık, açıklama, kategori, görünürlük ve SERP bilgilerini girin; AI kendi ürününüzle karşılaştırır ve
          fiyat değişimlerini takip eder.
        </p>
        <div className="space-y-2">
          <Label htmlFor="c-name">Rakip / ürün adı *</Label>
          <Input id="c-name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-url">Bağlantı</Label>
          <Input id="c-url" placeholder="https://…" value={form.url} onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))} />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="c-source">Kaynak</Label>
            <Input id="c-source" value={form.source} onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-price">Rakip fiyatı</Label>
            <Input id="c-price" inputMode="decimal" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-product">Kendi ürününüz</Label>
          <Select value={form.productId} onValueChange={(value) => setForm((p) => ({ ...p, productId: value }))}>
            <SelectTrigger id="c-product">
              <SelectValue placeholder="Ürün seçin" />
            </SelectTrigger>
            <SelectContent>
              {props.products.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-title">Rakip başlığı</Label>
          <Input id="c-title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-desc">Rakip açıklaması</Label>
          <Textarea id="c-desc" rows={4} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="c-cat">Kategori</Label>
            <Input id="c-cat" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-vis">Görünürlük (0-100)</Label>
            <Input id="c-vis" inputMode="numeric" value={form.visibility} onChange={(e) => setForm((p) => ({ ...p, visibility: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-serp">SERP sırası</Label>
            <Input id="c-serp" inputMode="numeric" value={form.serp} onChange={(e) => setForm((p) => ({ ...p, serp: e.target.value }))} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-th">Bildirim eşiği (%)</Label>
          <Input id="c-th" inputMode="decimal" value={form.threshold} onChange={(e) => setForm((p) => ({ ...p, threshold: e.target.value }))} />
          <p className="text-xs text-muted-foreground">
            Rakip fiyatı sizden bu oranın üzerinde düşükse mağaza bildirimi oluşturulur.
          </p>
        </div>
        <Button disabled={save.isPending || form.name.trim().length < 2} onClick={() => save.mutate()}>
          {save.isPending ? "Kaydediliyor…" : "Kaydet ve fiyatı takip et"}
        </Button>
      </section>

      <section className="space-y-3">
        {props.loading ? <Skeleton className="h-40 w-full" /> : null}
        {!props.loading && props.rows.length === 0 ? (
          <div className="surface-card p-6 text-sm text-muted-foreground">Henüz rakip ürün eklemediniz.</div>
        ) : null}
        {props.rows.map((row) => (
          <article key={row.id} className="surface-card space-y-3 p-4">
            <header className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-medium">{row.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {row.source}
                  {row.productTitle ? ` · eşleşen ürün: ${row.productTitle}` : " · ürün eşleşmesi yok"}
                  {row.lastCheckedAt ? ` · son kontrol: ${new Date(row.lastCheckedAt).toLocaleString("tr-TR")}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {row.cheaperThanUs ? <Badge variant="destructive">Rakip daha ucuz</Badge> : null}
                {row.contentScore != null ? <Badge variant="secondary">İçerik {row.contentScore}/100</Badge> : null}
                <Button size="sm" variant="outline" disabled={analyze.isPending} onClick={() => analyze.mutate(row.id)}>
                  AI analiz
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove.mutate(row.id)} aria-label="Sil">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </header>

            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">Rakip fiyatı</dt>
                <dd className="font-medium">{money(row.competitorPrice, row.currency)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Sizin fiyatınız</dt>
                <dd className="font-medium">{money(row.ourPrice, row.currency)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Fark</dt>
                <dd className="font-medium">{row.diffPct == null ? "—" : `%${row.diffPct}`}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Önceki fiyat</dt>
                <dd className="font-medium">{money(row.previousPrice, row.currency)}</dd>
              </div>
            </dl>

            {row.aiAnalysis ? (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p className="whitespace-pre-wrap">{row.aiAnalysis}</p>
                {Array.isArray(row.aiSummary["actions"]) ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                    {(row.aiSummary["actions"] as string[]).map((action, index) => (
                      <li key={index}>{action}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </article>
        ))}
      </section>
    </div>
  );
}

/* ------------------------------------------------------ ürün açıklama paketi */

function ProductCopyTab(props: { storeId: string; products: ProductOption[] }) {
  const generateFn = useServerFn(generateProductCopy);
  const applyFn = useServerFn(applyProductCopyDraft);
  const [selected, setSelected] = useState<string[]>([]);
  const [tone, setTone] = useState<(typeof TONES)[number]>("profesyonel");
  const [keywords, setKeywords] = useState("");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("tr");
    if (!term) return props.products;
    return props.products.filter((product) => product.title.toLocaleLowerCase("tr").includes(term));
  }, [props.products, search]);

  const generate = useMutation({
    mutationFn: async () =>
      generateFn({
        data: { storeId: props.storeId, productIds: selected, tone, ...(keywords.trim() ? { keywords } : {}) },
      }),
    onSuccess: (result) => toast.success(`${result.generated} ürün için açıklama üretildi`),
    onError: (error: Error) => toast.error(error.message),
  });

  const apply = useMutation({
    mutationFn: async (draftId: string) =>
      applyFn({ data: { storeId: props.storeId, draftId, target: "both" } }),
    onSuccess: () => toast.success("Ürüne uygulandı"),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
      <section className="surface-card space-y-3 p-4">
        <h2 className="font-display text-lg font-semibold">Toplu ürün açıklaması</h2>
        <p className="text-sm text-muted-foreground">
          Seçtiğiniz ürünler için SEO, kısa, uzun, teknik, satış ve sosyal medya açıklaması üretilir (en fazla 20 ürün).
        </p>
        <div className="space-y-2">
          <Label htmlFor="p-tone">Ton</Label>
          <Select value={tone} onValueChange={(value) => setTone(value as (typeof TONES)[number])}>
            <SelectTrigger id="p-tone">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TONES.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-kw">Anahtar kelimeler</Label>
          <Input id="p-kw" value={keywords} onChange={(event) => setKeywords(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-search">Ürün ara</Label>
          <Input id="p-search" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border p-2">
          {filtered.map((product) => (
            <label key={product.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted/60">
              <Checkbox
                checked={selected.includes(product.id)}
                onCheckedChange={(checked) =>
                  setSelected((prev) =>
                    checked ? [...prev, product.id].slice(0, 20) : prev.filter((id) => id !== product.id),
                  )
                }
              />
              <span className="flex-1">{product.title}</span>
              <span className="text-xs text-muted-foreground">{money(product.price, product.currency)}</span>
            </label>
          ))}
          {filtered.length === 0 ? <p className="p-2 text-sm text-muted-foreground">Ürün bulunamadı.</p> : null}
        </div>
        <Button disabled={generate.isPending || selected.length === 0} onClick={() => generate.mutate()}>
          {generate.isPending ? "Üretiliyor…" : `${selected.length} ürün için üret`}
        </Button>
      </section>

      <section className="space-y-3">
        {generate.isPending ? <Skeleton className="h-48 w-full" /> : null}
        {(generate.data?.results ?? []).map((item) => (
          <article key={item.draftId} className="surface-card space-y-3 p-4">
            <header className="flex items-center justify-between gap-2">
              <h3 className="font-medium">{item.title}</h3>
              <Button size="sm" disabled={apply.isPending} onClick={() => apply.mutate(item.draftId)}>
                Ürüne uygula
              </Button>
            </header>
            {Object.entries(item.fields).map(([key, value]) => (
              <div key={key}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {COPY_LABELS[key] ?? key}
                </p>
                <p className="whitespace-pre-wrap text-sm">{value}</p>
              </div>
            ))}
          </article>
        ))}
        {!generate.isPending && !generate.data ? (
          <div className="surface-card p-6 text-sm text-muted-foreground">
            Ürün seçip üretime başladığınızda sonuçlar burada listelenir.
          </div>
        ) : null}
      </section>
    </div>
  );
}

/* --------------------------------------------------------- kategori içeriği */

function CategoryTab(props: { storeId: string; categories: { id: string; name: string }[] }) {
  const generateFn = useServerFn(generateCategoryPack);
  const applyFn = useServerFn(applyCategoryPack);
  const [categoryId, setCategoryId] = useState("");
  const [keywords, setKeywords] = useState("");

  const generate = useMutation({
    mutationFn: async () =>
      generateFn({ data: { storeId: props.storeId, categoryId, ...(keywords.trim() ? { keywords } : {}) } }),
    onSuccess: () => toast.success("Kategori içeriği üretildi"),
    onError: (error: Error) => toast.error(error.message),
  });
  const apply = useMutation({
    mutationFn: async (draftId: string) => applyFn({ data: { storeId: props.storeId, draftId } }),
    onSuccess: () => toast.success("Kategoriye uygulandı"),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
      <section className="surface-card space-y-3 p-4">
        <h2 className="font-display text-lg font-semibold">Kategori SEO içeriği</h2>
        <div className="space-y-2">
          <Label htmlFor="cat-select">Kategori</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger id="cat-select">
              <SelectValue placeholder="Kategori seçin" />
            </SelectTrigger>
            <SelectContent>
              {props.categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cat-kw">Anahtar kelimeler</Label>
          <Input id="cat-kw" value={keywords} onChange={(event) => setKeywords(event.target.value)} />
        </div>
        <Button disabled={generate.isPending || !categoryId} onClick={() => generate.mutate()}>
          {generate.isPending ? "Üretiliyor…" : "SEO metni ve SSS üret"}
        </Button>
      </section>

      <section className="surface-card space-y-3 p-4">
        {generate.isPending ? <Skeleton className="h-48 w-full" /> : null}
        {generate.data ? (
          <>
            <header className="flex items-center justify-between gap-2">
              <h3 className="font-medium">{generate.data.category.name}</h3>
              <Button size="sm" disabled={apply.isPending} onClick={() => apply.mutate(generate.data!.draftId)}>
                Kategoriye uygula
              </Button>
            </header>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Meta başlık</p>
              <p className="text-sm">{generate.data.fields.metaTitle}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Meta açıklama</p>
              <p className="text-sm">{generate.data.fields.metaDescription}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">SEO açıklaması</p>
              <p className="whitespace-pre-wrap text-sm">{generate.data.fields.seoDescription}</p>
            </div>
            {generate.data.fields.faq.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">SSS</p>
                {generate.data.fields.faq.map((item, index) => (
                  <div key={index} className="rounded-lg bg-muted/50 p-3 text-sm">
                    <p className="font-medium">{item.question}</p>
                    <p className="text-muted-foreground">{item.answer}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Kategori seçip üretin; sonuç burada görünür.</p>
        )}
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------- blog paketi */

function BlogTab(props: { storeId: string }) {
  const generateFn = useServerFn(generateBlogPack);
  const applyFn = useServerFn(applyBlogPack);
  const [topic, setTopic] = useState("");
  const [keywords, setKeywords] = useState("");
  const [tone, setTone] = useState<(typeof TONES)[number]>("profesyonel");
  const [length, setLength] = useState<"kısa" | "orta" | "uzun">("orta");

  const generate = useMutation({
    mutationFn: async () =>
      generateFn({
        data: {
          storeId: props.storeId,
          topic: topic.trim(),
          tone,
          length,
          ...(keywords.trim() ? { keywords } : {}),
        },
      }),
    onSuccess: () => toast.success("Blog paketi hazır"),
    onError: (error: Error) => toast.error(error.message),
  });
  const apply = useMutation({
    mutationFn: async (draftId: string) => applyFn({ data: { storeId: props.storeId, draftId } }),
    onSuccess: (result) => toast.success(`Taslak blog yazısı oluşturuldu: ${result.slug}`),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
      <section className="surface-card space-y-3 p-4">
        <h2 className="font-display text-lg font-semibold">Blog paketi</h2>
        <div className="space-y-2">
          <Label htmlFor="b-topic">Konu *</Label>
          <Input id="b-topic" placeholder="2026 yaz modası" value={topic} onChange={(event) => setTopic(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="b-kw">Anahtar kelimeler</Label>
          <Input id="b-kw" value={keywords} onChange={(event) => setKeywords(event.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="b-tone">Ton</Label>
            <Select value={tone} onValueChange={(value) => setTone(value as (typeof TONES)[number])}>
              <SelectTrigger id="b-tone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="b-len">Uzunluk</Label>
            <Select value={length} onValueChange={(value) => setLength(value as "kısa" | "orta" | "uzun")}>
              <SelectTrigger id="b-len">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kısa">Kısa</SelectItem>
                <SelectItem value="orta">Orta</SelectItem>
                <SelectItem value="uzun">Uzun</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button disabled={generate.isPending || topic.trim().length < 3} onClick={() => generate.mutate()}>
          {generate.isPending ? "Yazılıyor…" : "Blog paketi üret"}
        </Button>
      </section>

      <section className="surface-card space-y-3 p-4">
        {generate.isPending ? <Skeleton className="h-64 w-full" /> : null}
        {generate.data ? (
          <>
            <header className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-lg font-semibold">{generate.data.fields.title}</h3>
              <Button size="sm" disabled={apply.isPending} onClick={() => apply.mutate(generate.data!.draftId)}>
                Taslak yazı olarak kaydet
              </Button>
            </header>
            <p className="text-sm text-muted-foreground">{generate.data.fields.metaTitle}</p>
            <p className="text-sm">{generate.data.fields.metaDescription}</p>
            {generate.data.fields.keywords.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {generate.data.fields.keywords.map((keyword) => (
                  <Badge key={keyword} variant="secondary">
                    {keyword}
                  </Badge>
                ))}
              </div>
            ) : null}
            <p className="whitespace-pre-wrap text-sm">{generate.data.fields.introduction}</p>
            <p className="whitespace-pre-wrap text-sm">{generate.data.fields.article}</p>
            {generate.data.fields.faq.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">SSS</p>
                {generate.data.fields.faq.map((item, index) => (
                  <div key={index} className="rounded-lg bg-muted/50 p-3 text-sm">
                    <p className="font-medium">{item.question}</p>
                    <p className="text-muted-foreground">{item.answer}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Konu girin; başlık, giriş, bölümler, makale, SSS ve meta üretilir.</p>
        )}
      </section>
    </div>
  );
}

/* -------------------------------------------------------------- hukuki metin */

function LegalTab(props: { storeId: string }) {
  const generateFn = useServerFn(generateLegalDocument);
  const applyFn = useServerFn(applyLegalDocument);
  const [kind, setKind] = useState<(typeof LEGAL_OPTIONS)[number]["value"]>("kvkk");
  const [companyName, setCompanyName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [notes, setNotes] = useState("");

  const generate = useMutation({
    mutationFn: async () =>
      generateFn({
        data: {
          storeId: props.storeId,
          kind,
          ...(companyName.trim() ? { companyName } : {}),
          ...(contactEmail.trim() ? { contactEmail } : {}),
          ...(notes.trim() ? { notes } : {}),
        },
      }),
    onSuccess: () => toast.success("Taslak hazır — avukat kontrolü gerekir"),
    onError: (error: Error) => toast.error(error.message),
  });
  const apply = useMutation({
    mutationFn: async (draftId: string) => applyFn({ data: { storeId: props.storeId, draftId } }),
    onSuccess: () => toast.success("Yayınlanmamış sayfa olarak kaydedildi"),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
      <section className="surface-card space-y-3 p-4">
        <h2 className="font-display text-lg font-semibold">Hukuki metin taslağı</h2>
        <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
          Üretilen metinler yalnızca taslaktır ve hukuki danışmanlık yerine geçmez. Yayınlamadan önce bir avukata
          danışın.
        </div>
        <div className="space-y-2">
          <Label htmlFor="l-kind">Belge türü</Label>
          <Select value={kind} onValueChange={(value) => setKind(value as typeof kind)}>
            <SelectTrigger id="l-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEGAL_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="l-company">Ticari unvan</Label>
          <Input id="l-company" value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="l-mail">İletişim e-postası</Label>
          <Input id="l-mail" type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="l-notes">Ek notlar</Label>
          <Textarea id="l-notes" rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>
        <Button disabled={generate.isPending} onClick={() => generate.mutate()}>
          {generate.isPending ? "Hazırlanıyor…" : "Taslak üret"}
        </Button>
      </section>

      <section className="surface-card space-y-3 p-4">
        {generate.isPending ? <Skeleton className="h-64 w-full" /> : null}
        {generate.data ? (
          <>
            <header className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-lg font-semibold">{generate.data.title}</h3>
              <Button size="sm" disabled={apply.isPending} onClick={() => apply.mutate(generate.data!.draftId)}>
                Sayfa olarak kaydet
              </Button>
            </header>
            <p className="whitespace-pre-wrap text-sm">{generate.data.content}</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Belge türünü seçip taslak üretin.</p>
        )}
      </section>
    </div>
  );
}
